const vscode = acquireVsCodeApi();

window.onload = function () {
    // Handle offset of sticky elements
    document.querySelectorAll('.sticky').forEach(e => e.style.top = `${e.offsetTop}px`);
};

function onDelete(selected) {
    vscode.postMessage({
        command: 'delete',
        selected: [selected]
    });
}

function onDeleteSelected() {
    const selectedElements = document.querySelectorAll('tbody vscode-checkbox.checked');
    const selected = Array.from(selectedElements, element => element.getAttribute('path'));

    vscode.postMessage({
        command: 'delete',
        selected: selected
    });
}

function onSelectAllChange(checkbox) {
    document
        .querySelectorAll('tbody vscode-checkbox')
        .forEach(e => e.checked = checkbox.checked);
}

function onToggleAll() {
    document
        .querySelectorAll('tbody vscode-checkbox')
        .forEach(e => e.checked = !e.checked);
}

function onToggleMissing() {
    document
        .querySelectorAll('tbody vscode-checkbox[exist="false"]')
        .forEach(e => e.checked = !e.checked);
}

function onToggleRemote() {
    document
        .querySelectorAll('tbody vscode-checkbox[remote="true"]')
        .forEach(e => e.checked = !e.checked);
}

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'update':
            document.querySelector('tbody').innerHTML = message.html;
            break;
    }
});