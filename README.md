# SyntaxShift

Convert code between programming languages inside VS Code.

**Languages:** Python, Java, JavaScript, C, C++

## The problem it solves

Moving code from one language to another usually means leaving the editor, writing a prompt in a chat tool, copying the answer, creating a new file and pasting it in. SyntaxShift does this with one command inside VS Code.

## How it works

1. Open a code file. Select some code, or select nothing to convert the whole file.
2. Run **SyntaxShift: Convert Code** (Command Palette, or right-click in the editor).
3. Pick the target language. The source language is detected automatically.
4. The result opens in an `Untitled` tab beside your code.
5. Click **Save** in the popup to save it next to the original file.
   - A whole file keeps its name: `Demo.java` becomes `Demo.py`.
   - A selection is saved as `code-snippet.py`.

If a file with that name already exists, SyntaxShift asks before overwriting it.

## Setup

SyntaxShift uses **GitHub Copilot** when it is installed and signed in, so there is nothing to paste. VS Code may ask you once to allow the extension to use Copilot.

If Copilot is not available, run **SyntaxShift: Set Gemini API Key** and paste a free key from [Google AI Studio](https://aistudio.google.com). The key is stored in VS Code's encrypted secret storage.

```
Convert Code
   |
   v
Try GitHub Copilot --works--> result
   |
   '--not available--> Gemini key --> result
```

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `syntaxshift.provider` | `auto` | `auto`: Copilot first, then Gemini. `copilot` or `gemini`: use only that one |
| `syntaxshift.model` | `gemini-flash-lite-latest` | Gemini model used with your key |
| `syntaxshift.timeoutSeconds` | `30` | Seconds to wait per request |

## Limitations

- Your code is sent to GitHub Copilot or to Google Gemini. Do not use it on private code you are not allowed to share.
- The result is a first draft written by an AI. Review it before relying on it, because it may not behave exactly like the original.
- It converts one file or selection at a time, not whole projects.
- Which Copilot models you can use depends on your Copilot plan.

## Project layout

| File | Purpose |
|---|---|
| `extension.js` | Commands and the main flow |
| `languages.js` | The supported languages |
| `prompt.js` | Builds the prompt and cleans the reply |
| `providers/` | Copilot, Gemini, and the fallback between them |
| `actions.js` | The save popup |

## License

MIT