const { callCopilot } = require('./copilot');
const { callGemini } = require('./gemini');

// ctx: {
//   provider:  'auto' | 'copilot' | 'gemini'   (the user's setting)
//   getApiKey: function that returns the saved Gemini key, or undefined
//   model:     Gemini model name
//   timeoutMs: per-request timeout
//   log:       output channel
// }
// Returns { text, provider } where provider says who answered.
async function convertWithProviders(prompt, ctx) {
    const { provider, log } = ctx;

    // Step 1: Copilot, unless the user chose Gemini only.
    if (provider !== 'gemini') {
        try {
            const text = await callCopilot(prompt, ctx.timeoutMs, log);
            if (text.trim() !== '') {
                return { text, provider: 'Copilot' };
            }
            throw new Error('Copilot returned an empty reply.');
        } catch (err) {
            log.appendLine(`Copilot failed: ${err.message}`);
            if (provider === 'copilot') {
                // The user asked for Copilot only, so there is no fallback.
                throw err;
            }
            log.appendLine('Falling back to the Gemini key...');
        }
    }

    // Step 2: Gemini with the user's own key.
    const apiKey = await ctx.getApiKey();
    if (!apiKey) {
        const error = new Error('No Gemini key saved.');
        error.code = 'NO_KEY';   // lets the caller offer a "Set key" button
        throw error;
    }

    const text = await callGemini(
        prompt,
        { apiKey, model: ctx.model, timeoutMs: ctx.timeoutMs, maxAttempts: 3 },
        log
    );
    return { text, provider: 'Gemini' };
}

module.exports = { convertWithProviders };