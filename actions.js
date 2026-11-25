const vscode = require('vscode');
const path = require('path');

// Where to save, next to the original file:
//   whole file -> name.ext          (for example Demo.py)
//   selection  -> code-snippet.ext  (for example code-snippet.py)
function targetUri(editor, target, wholeFile) {
    if (editor.document.uri.scheme !== 'file') {
        return undefined;   // an untitled tab has no folder to save into
    }
    const parsed = path.parse(editor.document.uri.fsPath);
    const name = wholeFile ? parsed.name : 'code-snippet';
    return vscode.Uri.file(path.join(parsed.dir, name + target.ext));
}

async function exists(uri) {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

// Closes the unsaved "Untitled" preview tab without asking to save it.
async function closePreview(previewDoc) {
    const key = previewDoc.uri.toString();
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === key) {
                await vscode.window.showTextDocument(previewDoc, { viewColumn: group.viewColumn, preview: false });
                await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
                return;
            }
        }
    }
}

// Asks "Save?", and if the user agrees, saves the converted file and closes the preview.
async function askToSave(editor, target, wholeFile, text, previewDoc) {
    const what = wholeFile ? 'file' : 'snippet';
    const choice = await vscode.window.showInformationMessage(
        `SyntaxShift: converted to ${target.name}. Save the converted ${what}?`,
        'Save'
    );
    if (choice !== 'Save') { return; }

    // Default location: next to the original. If there is none, ask where.
    let uri = targetUri(editor, target, wholeFile);
    if (!uri) {
        uri = await vscode.window.showSaveDialog({});
        if (!uri) { return; }
    } else if (await exists(uri)) {
        const overwrite = await vscode.window.showWarningMessage(
            `${path.basename(uri.fsPath)} already exists. Overwrite it?`,
            'Overwrite'
        );
        if (overwrite !== 'Overwrite') { return; }
    }

    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
    await closePreview(previewDoc);

    const saved = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(saved, vscode.ViewColumn.Beside);
}

module.exports = { askToSave };