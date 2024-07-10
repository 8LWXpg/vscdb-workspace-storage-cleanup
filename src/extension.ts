import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import DatabaseConstructor from 'better-sqlite3';
import { get } from 'http';

/**
 * describes the information related to a workspace or file.
 *
 * @property {string} name - The name of the workspace or file.
 * @property {string} path - The uri path of the workspace or file.
 * @property {boolean} remote - Indicates whether the workspace or file is remote.
 * @property {string} label - The label of the workspace or file, usually filesystem path or remote host.
 * @property {boolean} [pathExists] - Indicates whether the workspace or file path exists. This property is optional.
 */
type TargetInfo = {
	name: string;
	path: string;
	remote: boolean;
	label: string;
	pathExists?: boolean;
};

type DBRow = {
	value: string;
};

type Entry = {
	label?: string;
} & ({ folderUri: string; fileUri?: never } | { folderUri?: never; fileUri: string });

type ParsedValue = {
	entries: Entry[];
};

type QueryType = 'folderUri' | 'fileUri';

export function activate(context: vscode.ExtensionContext) {
	(global as any).testExtensionContext = context;
	let currentPanels = {
		workspace: undefined as vscode.WebviewPanel | undefined,
		file: undefined as vscode.WebviewPanel | undefined,
	};

	const globalStoragePath = path.dirname(context.globalStorageUri.fsPath);
	const vscdb = `${globalStoragePath}/state.vscdb`;

	context.subscriptions.push(
		vscode.commands.registerCommand('vscdb-workspace-storage-cleanup.run', () => {
			const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

			if (currentPanels.workspace) {
				currentPanels.workspace.reveal(columnToShowIn);
				return;
			}

			currentPanels.workspace = vscode.window.createWebviewPanel(
				'table',
				'Workspace Cleanup',
				columnToShowIn || vscode.ViewColumn.One,
				{
					localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
					enableScripts: true,
				}
			);

			const updateWebView = (targets: TargetInfo[]) => {
				if (!currentPanels.workspace) {
					return;
				}
				currentPanels.workspace.webview.postMessage({
					command: 'update',
					html: getTableRows(targets),
				});
			};

			currentPanels.workspace.webview.html = getWebView(currentPanels.workspace, context, getTargetInfo(vscdb));

			// Reset when the current panel is closed
			currentPanels.workspace.onDidDispose(
				() => {
					currentPanels.workspace = undefined;
				},
				null,
				context.subscriptions
			);

			currentPanels.workspace.webview.onDidReceiveMessage((message) => {
				switch (message.command) {
					case 'delete':
						updateWebView(deleteTarget(vscdb, message.selected));
						break;
					default:
						break;
				}
			});
		}),
		vscode.commands.registerCommand('vscdb-workspace-storage-cleanup.file', () => {
			const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

			if (currentPanels.file) {
				currentPanels.file.reveal(columnToShowIn);
				return;
			}

			currentPanels.file = vscode.window.createWebviewPanel(
				'table',
				'Files Cleanup',
				columnToShowIn || vscode.ViewColumn.One,
				{
					localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
					enableScripts: true,
				}
			);

			const updateWebView = (targets: TargetInfo[]) => {
				if (!currentPanels.file) {
					return;
				}
				currentPanels.file.webview.postMessage({
					command: 'update',
					html: getTableRows(targets),
				});
			};

			currentPanels.file.webview.html = getWebView(currentPanels.file, context, getTargetInfo(vscdb, 'fileUri'));

			// Reset when the current panel is closed
			currentPanels.file.onDidDispose(
				() => {
					currentPanels.file = undefined;
				},
				null,
				context.subscriptions
			);

			currentPanels.file.webview.onDidReceiveMessage((message) => {
				switch (message.command) {
					case 'delete':
						updateWebView(deleteTarget(vscdb, message.selected, 'fileUri'));
						break;
					default:
						break;
				}
			});
		})
	);
}

export function deactivate() {}

function getTableRows(info: TargetInfo[]): string {
	return info
		.map((row) => {
			const icon = row.remote ? '🔗' : row.pathExists ? '✔️' : '❌';
			return /* html */ `<tr>
	<td><vscode-checkbox remote="${row.remote}" exist="${row.remote || row.pathExists}" path="${row.path}"></td>
	<td>${row.name}</td>
	<td>${row.label}</td>
	<td>${icon}</td>
	<td>
		<a href="Delete" onclick="onDelete('${row.path}')" class="icon-link">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="16" height="16">
    			<path fill="currentColor" d="M32 464a48 48 0 0 0 48 48h288a48 48 0 0 0 48-48V128H32zm272-256a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zM432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16z"/>
  			</svg>
		</a>
	</td>
</tr>`;
		})
		.join('');
}

function getWebView(currentPanel: vscode.WebviewPanel, context: vscode.ExtensionContext, info: TargetInfo[]): string {
	const scriptUri = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'webView.js'));
	const styleUri = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'style.css'));
	const componentUri = currentPanel.webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'media', 'component.js')
	);
	const tableRows = getTableRows(info);

	return /* html */ `<!DOCTYPE html>
<html lang="en">

<head>
	<link rel="stylesheet" href="${styleUri}">
	<script src="${scriptUri}"></script>
	<script type="module" src="${componentUri}"></script>
</head>

<body>
	<table>
		<thead class=sticky>
			<tr>
				<th colspan=5>
					<vscode-button onclick="onToggleAll()">Toggle all</vscode-button>
					<vscode-button onclick="onToggleMissing()">Toggle missing</vscode-button>
					<vscode-button onclick="onToggleRemote()">Toggle remote</vscode-button>
					<vscode-button onclick="onDeleteSelected()">Delete</vscode-button>
				</th>
			</tr>
			<tr>
				<th><vscode-checkbox id="select-all" onchange="onSelectAllChange(this)"></th>
				<th>Name</th>
				<th>Path / URL</th>
				<th>Exists</th>
				<th>Delete</th>
			</tr>
		</thead>
		<tbody>
			${tableRows}
		</tbody>
	</table>
</body>

</html>`;
}

function getTargetInfo(vscdb: string, type: QueryType = 'folderUri'): TargetInfo[] {
	try {
		const db = new DatabaseConstructor(vscdb);
		const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'").get() as DBRow;
		const value = row?.value ?? '';
		const parsedValue = JSON.parse(value) as ParsedValue;
		return parsedValue.entries
			.filter((obj) => obj.hasOwnProperty(type))
			.map((i) => {
				const p = i[type] as string;
				const name = path.basename(vscode.Uri.parse(p).fsPath);
				const label = i.label ? i.label : vscode.Uri.parse(p).fsPath;
				const remote = Boolean(i.label);
				const pathExists = !remote && fs.existsSync(label);

				return { name, path: p, remote, label, pathExists };
			});
	} catch (e) {
		vscode.window.showErrorMessage(`Error: ${e}`);
		return [];
	}
}

function deleteTarget(vscdb: string, target: string[], type: QueryType = 'folderUri'): TargetInfo[] {
	try {
		const db = new DatabaseConstructor(vscdb);
		const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'").get() as DBRow;
		const data = JSON.parse(row.value) as ParsedValue;

		// Filter the entries array
		// @ts-ignore
		data.entries = data.entries.filter((entry) => !target.includes(entry[type]));

		// Save the modified object back to the ItemTable
		db.prepare("UPDATE ItemTable SET value = ? WHERE key = 'history.recentlyOpenedPathsList'").run(
			JSON.stringify(data)
		);

		return data.entries
			.filter((obj: object) => obj.hasOwnProperty(type))
			.map((i) => {
				const p = i[type] as string;
				const name = path.basename(vscode.Uri.parse(p).fsPath);
				const label = i.label ? i.label : vscode.Uri.parse(p).fsPath;
				const remote = !!i.label;
				const pathExists = !remote && fs.existsSync(label);

				return { name, path: p, remote, label, pathExists };
			});
	} catch (e) {
		vscode.window.showErrorMessage(`Error: ${e}`);
		return [];
	}
}
