// Calls Gemini with the user's own key.
// opts: { apiKey, model, timeoutMs, maxAttempts }
// log:  a VS Code output channel, used to record each attempt
async function callGemini(prompt, opts, log) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        const started = Date.now();
        log.appendLine(`Gemini attempt ${attempt}/${opts.maxAttempts} using ${opts.model}...`);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // The key goes in a header, not in the URL (Ravi's put it in the URL).
                    'x-goog-api-key': opts.apiKey
                },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                signal: AbortSignal.timeout(opts.timeoutMs)
            });

            const seconds = ((Date.now() - started) / 1000).toFixed(1);
            log.appendLine(`  HTTP ${res.status} after ${seconds}s`);

            if (res.ok) {
                const data = await res.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            }

            const error = new Error(`Gemini API ${res.status}: ${await res.text()}`);
            error.status = res.status;
            throw error;
        } catch (err) {
            const cause = err.cause ? ` (${err.cause.code ?? err.cause.message})` : '';
            log.appendLine(`  Error: ${err.message}${cause}`);

            // Errors that came from the API carry a status. Only 503 (overloaded)
            // and 429 (rate limited) are worth retrying. A bad key (403) or wrong
            // model (404) will fail again, so stop at once.
            // Network errors and timeouts have no status, so they are retried.
            const retryable = err.status === undefined || err.status === 503 || err.status === 429;

            if (!retryable || attempt === opts.maxAttempts) {
                if (err.status === undefined && cause) {
                    err.message += cause;
                }
                throw err;
            }

            const waitMs = 2000 * attempt;
            log.appendLine(`  Retrying in ${waitMs / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }
    }

    throw new Error('Unknown error');
}

module.exports = { callGemini };