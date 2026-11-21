const vscode = require('vscode');

// Sends the prompt to GitHub Copilot through VS Code's Language Model API.
// The user pastes nothing: Copilot is already signed in inside VS Code.
// The first time, VS Code asks the user for permission. Declining counts as a failure.
async function callCopilot(prompt, timeoutMs, log) {
    log.appendLine('Copilot: looking for a model...');

    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    if (models.length === 0) {
        throw new Error('No Copilot model is available (Copilot missing, not signed in, or no access).');
    }

    const model = models[0];
    log.appendLine(`Copilot: using ${model.name || model.id}`);

    // A cancellation token lets us stop the request if it takes too long.
    const cts = new vscode.CancellationTokenSource();
    const timer = setTimeout(() => cts.cancel(), timeoutMs);

    try {
        const started = Date.now();
        const response = await model.sendRequest(
            [vscode.LanguageModelChatMessage.User(prompt)],
            {},
            cts.token
        );

        // The reply arrives in pieces (a stream). Join them into one string.
        let text = '';
        for await (const chunk of response.text) {
            text += chunk;
        }

        log.appendLine(`Copilot: answered after ${((Date.now() - started) / 1000).toFixed(1)}s`);
        return text;
    } catch (err) {
        // VS Code gives Copilot errors a code, such as NoPermissions or Blocked.
        if (err instanceof vscode.LanguageModelError) {
            throw new Error(`Copilot error (${err.code}): ${err.message}`);
        }
        if (cts.token.isCancellationRequested) {
            throw new Error('Copilot took too long.');
        }
        throw err;
    } finally {
        clearTimeout(timer);
        cts.dispose();
    }
}

module.exports = { callCopilot };