// options.fragment:  true when only a selection is converted (no boilerplate)
// options.className: for Java output, the class must match the file name
function buildPrompt(code, from, to, options = {}) {
    const rules = [
        `Convert the following ${from} code to ${to}.`,
        'Rules:',
        '- Keep the same logic and behavior.',
        '- Preserve comments, translating them if needed.',
        `- Use idiomatic ${to} and its standard library equivalents.`,
        '- Do not add unused imports or commented-out code.',
        '- If something cannot be translated directly, add a short comment explaining the change.'
    ];

    if (options.fragment) {
        rules.push(
            '- The input is only a FRAGMENT selected from a larger file.',
            '- Convert only those lines. Do NOT add a main function, class, entry point, or boilerplate.',
            '- Add no imports or includes.'
        );
    } else {
        rules.push(`- Add only the imports or includes that the ${to} code actually uses. If it needs none, add none.`);
    }

    if (to === 'Java' && options.className && !options.fragment) {
        rules.push(`- The public class must be named exactly: ${options.className}`);
    }

    rules.push(`Return ONLY the ${to} code, with no explanations and no markdown fences.`, '', code);
    return rules.join('\n');
}

// Models sometimes wrap code in ``` fences even when told not to.
function cleanResponse(text) {
    return text
        .trim()
        .replace(/^```[\w+#-]*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim();
}

module.exports = { buildPrompt, cleanResponse };