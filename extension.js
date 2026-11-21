const vscode = require('vscode');
const path = require('path');
const { LANGUAGES, findByVsCodeId } = require('./languages');
const { buildPrompt, cleanResponse } = require('./prompt');
const { convertWithProviders } = require('./providers');

const KEY_NAME = 'syntaxshiftGeminiKey';

// Turns the language list into rows for a quick-pick menu.
function toItems(langs) {
    return langs.map(lang => ({ label: lang.name, lang }));
}

function activate(context) {
    const log = vscode.window.createOutputChannel('SyntaxShift');
    // Builds the settings object that convertWithProviders needs.
    function readContext() {
        const config = vscode.workspace.getConfiguration('syntaxshift');
        return {
            provider: config.get('provider', 'auto'),
            model: config.get('model', 'gemini-flash-lite-latest').trim(),
            timeoutMs: config.get('timeoutSeconds', 30) * 1000,
            getApiKey: () => context.secrets.get(KEY_NAME),
            log
        };
    }

    // Command 1: save the user's Gemini key in VS Code's encrypted storage.
    const setKey = vscode.commands.registerCommand('syntaxshift.setApiKey', async () => {
        const key = await vscode.window.showInputBox({
            prompt: 'Enter your Gemini API key',
            password: true,
            ignoreFocusOut: true
        });
        if (key) {
            await context.secrets.store(KEY_NAME, key.trim());
            vscode.window.showInformationMessage('SyntaxShift: API key saved.');
        }
    });

    // Command 2: test the provider chain.
    const testProvider = vscode.commands.registerCommand('syntaxshift.testProvider', async () => {
        const ctx = readContext();
        log.show(true);
        log.appendLine(`--- Provider test (setting: ${ctx.provider}) ---`);
        try {
            const result = await convertWithProviders('Reply with the single word: ready', ctx);
            log.appendLine(`Answered by ${result.provider}: ${result.text.trim()}`);
            vscode.window.showInformationMessage(`SyntaxShift: ${result.provider} replied "${result.text.trim()}".`);
        } catch (err) {
            log.appendLine('FAILED: ' + err.message);
            vscode.window.showErrorMessage('SyntaxShift: ' + err.message);
        }
    });

    // Command 3: convert the selection, or the whole file.
    const convert = vscode.commands.registerCommand('syntaxshift.convert', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('SyntaxShift: open a code file first.');
            return;
        }

        // 1. The code: the selection, or the whole file if nothing is selected.
        const doc = editor.document;
        const wholeFile = editor.selection.isEmpty;
        const code = wholeFile ? doc.getText() : doc.getText(editor.selection);

        if (code.trim() === '') {
            vscode.window.showErrorMessage('SyntaxShift: there is no code to convert.');
            return;
        }

        // 2. The source language: detected from VS Code, or asked if unknown.
        let from = findByVsCodeId(doc.languageId);
        if (!from) {
            const picked = await vscode.window.showQuickPick(toItems(LANGUAGES), {
                placeHolder: 'Could not detect the language. Which language is this code?'
            });
            if (!picked) { return; }
            from = picked.lang;
        }

        // 3. The target language: everything except the source.
        const pickedTarget = await vscode.window.showQuickPick(
            toItems(LANGUAGES.filter(l => l.id !== from.id)),
            { placeHolder: `Convert ${from.name} to which language?` }
        );
        if (!pickedTarget) { return; }
        const target = pickedTarget.lang;

        // 4. For Java output, the class name should match the file name.
        // (Untitled documents have no file name, so we skip it for those.)
        let className;
        if (doc.uri.scheme === 'file') {
            className = path.parse(doc.uri.fsPath).name;
        }

        log.show(true);
        log.appendLine(`--- ${from.name} to ${target.name} ---`);
        log.appendLine(wholeFile
            ? `Input: whole file (${code.length} characters)`
            : `Input: selection (${code.length} characters)`);

        // 5. Convert under a progress notification.
        // The callback returns { text, provider }, or undefined if it failed.
        const outcome = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `SyntaxShift: converting ${from.name} to ${target.name}...`
            },
            async () => {
                try {
                    const prompt = buildPrompt(code, from.name, target.name, {
                        fragment: !wholeFile,
                        className
                    });
                    const result = await convertWithProviders(prompt, readContext());

                    const cleaned = cleanResponse(result.text);
                    if (cleaned === '') {
                        throw new Error('The model returned an empty response. Try again.');
                    }
                    log.appendLine(`Conversion done (${result.provider}).`);
                    return { text: cleaned, provider: result.provider };
                } catch (err) {
                    log.appendLine('FAILED: ' + err.message);
                    if (err.code === 'NO_KEY') {
                        const pick = await vscode.window.showWarningMessage(
                            'SyntaxShift: Copilot is not available and no Gemini key is saved.',
                            'Set Gemini API Key'
                        );
                        if (pick) {
                            vscode.commands.executeCommand('syntaxshift.setApiKey');
                        }
                    } else {
                        vscode.window.showErrorMessage('SyntaxShift: conversion failed. ' + err.message);
                    }
                    return undefined;
                }
            }
        );

        if (outcome === undefined) { return; }

        // 6. Show the result beside the original.
        const resultDoc = await vscode.workspace.openTextDocument({
            content: outcome.text,
            language: target.id
        });
        await vscode.window.showTextDocument(resultDoc, vscode.ViewColumn.Beside);
        vscode.window.setStatusBarMessage(`SyntaxShift: converted with ${outcome.provider}`, 5000);
    });

    context.subscriptions.push(setKey, testProvider, convert, log);
}

function deactivate() {}

module.exports = { activate, deactivate };