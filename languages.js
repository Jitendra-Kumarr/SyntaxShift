// An array of plain objects, one per supported language.
// name: shown to the user and used in the prompt
// id:   VS Code's language id
// ext:  file extension used when saving
const LANGUAGES = [
    { name: 'Python', id: 'python', ext: '.py' },
    { name: 'Java', id: 'java', ext: '.java' },
    { name: 'JavaScript', id: 'javascript', ext: '.js' },
    { name: 'C', id: 'c', ext: '.c' },
    { name: 'C++', id: 'cpp', ext: '.cpp' }
];

// Returns the matching language, or undefined if there is none.
function findByVsCodeId(id) {
    return LANGUAGES.find(lang => lang.id === id);
}

// module.exports makes these usable from other files with require().
module.exports = { LANGUAGES, findByVsCodeId };