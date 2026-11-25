const vscode = require('vscode');
const path = require('path');
const { LANGUAGES, findByVsCodeId } = require('./languages');
const { buildPrompt, cleanResponse } = require('./prompt');
const { convertWithProviders } = require('./providers');
const { askToSave } = require('./actions');

const KEY_NAME = 'syntaxshiftGeminiKey';

function toItems(langs) {
    return langs.map(lang => ({ label: lang.name, lang }));
}

function activate(context) {
    const log = vscode.window.createOutputChannel('SyntaxShift');

    // The settings the provider chain needs.
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

    // Command 1: save the user's Gemini key (only needed if Copilot is not available).
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

    // Command 2: convert the selection, or the whole file.
    const convert = vscode.commands.registerCommand('syntaxshift.convert', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('SyntaxShift: open a code file first.');
            return;
        }

        // 1. The code: the selection, or the whole file.
        const doc = editor.document;
        const wholeFile = editor.selection.isEmpty;
        const code = wholeFile ? doc.getText() : doc.getText(editor.selection);
        if (code.trim() === '') {
            vscode.window.showErrorMessage('SyntaxShift: there is no code to convert.');
            return;
        }

        // 2. Source language: detected from VS Code, or asked if unknown.
        let from = findByVsCodeId(doc.languageId);
        if (!from) {
            const picked = await vscode.window.showQuickPick(toItems(LANGUAGES), {
                placeHolder: 'Which language is this code?'
            });
            if (!picked) { return; }
            from = picked.lang;
        }

        // 3. Target language.
        const pickedTarget = await vscode.window.showQuickPick(
            toItems(LANGUAGES.filter(l => l.id !== from.id)),
            { placeHolder: `Convert ${from.name} to which language?` }
        );
        if (!pickedTarget) { return; }
        const target = pickedTarget.lang;

        // For Java output, the class name should match the file name.
        const className = doc.uri.scheme === 'file' ? path.parse(doc.uri.fsPath).name : undefined;

        log.show(true);
        log.appendLine(`--- ${from.name} to ${target.name} ---`);

        // 4. Convert (Copilot first, then the Gemini key).
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
                    const text = cleanResponse(result.text);
                    if (text === '') {
                        throw new Error('The model returned an empty response. Try again.');
                    }
                    log.appendLine(`Conversion done (${result.provider}).`);
                    return { text, provider: result.provider };
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

        // 5. Show the result in an unsaved "Untitled" tab beside the original.
        const preview = await vscode.workspace.openTextDocument({
            content: outcome.text,
            language: target.id
        });
        await vscode.window.showTextDocument(preview, vscode.ViewColumn.Beside);

        // 6. Ask whether to save it (a selection is saved as code-snippet.<ext>).
        await askToSave(editor, target, wholeFile, outcome.text, preview);
    });

    context.subscriptions.push(setKey, convert, log);
}

function deactivate() {}

module.exports = { activate, deactivate };