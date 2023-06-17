import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as sqlite3 from 'sqlite3';

interface IWorkspaceInfo {
	name: string;
	path: string;
	remote: boolean;
	label: string;
	pathExists?: boolean;
}

export function activate(context: vscode.ExtensionContext) {
	let currentPanel: vscode.WebviewPanel | undefined = undefined;

	context.subscriptions.push(
		vscode.commands.registerCommand('vscdb-workspace-storage-cleanup.run', () => {
			const columnToShowIn = vscode.window.activeTextEditor
				? vscode.window.activeTextEditor.viewColumn
				: undefined;

			if (currentPanel) {
				currentPanel.reveal(columnToShowIn);
				return;
			}

			const globalStoragePath = path.dirname(context.globalStorageUri.fsPath);
			const vscdb = `${globalStoragePath}/state.vscdb`;

			currentPanel = vscode.window.createWebviewPanel(
				'table',
				'Workspace Cleanup',
				columnToShowIn || vscode.ViewColumn.One,
				{
					localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
					enableScripts: true,
				}
			);

			const updateWebView = (workspaces: Promise<IWorkspaceInfo[]>) => {
				if (!currentPanel) {
					return;
				}
				getWebView(currentPanel, context, workspaces).then((html) => {
					if (!currentPanel) {
						return;
					}
					currentPanel.webview.html = html;
				});
			};

			updateWebView(getWorkspaceInfo(vscdb));

			// Reset when the current panel is closed
			currentPanel.onDidDispose(
				() => {
					currentPanel = undefined;
				},
				null,
				context.subscriptions
			);

			currentPanel.webview.onDidReceiveMessage(
				message => {
					switch (message.command) {
						case 'delete':
							updateWebView(deleteWorkspace(vscdb, message.selectedWorkspaces));
							break;
						default:
							break;
					}
				}
			);
		})
	);
}

export function deactivate() { }

async function getWebView(currentPanel: vscode.WebviewPanel, context: vscode.ExtensionContext, workspaceInfo: Promise<IWorkspaceInfo[]>): Promise<string> {
	const scriptUri = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'webView.js'));
	const styleUri = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'style.css'));

	const tableRows = (await workspaceInfo).map((row) => {
		const icon = row.remote ? '🔗' : row.pathExists ? '✔️' : '❌';
		return /* html */`<tr>
	<td><input type="checkbox" remote="${row.remote}" exist="${row.remote || row.pathExists}" path="${row.path}"></td>
	<td>${row.name}</td>
	<td>${row.label}</td>
	<td>${icon}</td>
	<td>
		<a href="Delete" onclick="onDelete('${row.path}')">Delete</a>
	</td>
</tr>`;
	}).join('');

	return /* html */`<!DOCTYPE html>
<html lang="en">

<head>
	<link rel="stylesheet" href="${styleUri}">
</head>

<body>
	<div class=sticky>
		<button onclick="onToggleAll()">Toggle all</button>
		<button onclick="onToggleFolderMissing()">Toggle folder missing</button>
		<button onclick="onToggleRemote()">Toggle remote</button>
		<button onclick="onDeleteSelected()">Delete</button>
	</div>
	<table>
		<thead>
			<tr class=sticky>
				<th><input type="checkbox" id="select-all" onchange="onSelectAllChange(this)"></th>
				<th>Name</th>
				<th>Path / URL</th>
				<th>Exists</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			${tableRows}
		</tbody>
	</table>
	<script src="${scriptUri}"></script>
</body>

</html>`;
}

function getWorkspaceInfo(vscdb: string): Promise<IWorkspaceInfo[]> {
	const db = new sqlite3.Database(vscdb);

	return new Promise<IWorkspaceInfo[]>((resolve, reject) => {
		db.serialize(() => {
			db.get("SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'", (err, row: { value?: string }) => {
				if (err) {
					reject(err);
				}
				const value = row?.value ?? '';
				const parsedValue = JSON.parse(value);
				const folders = parsedValue.entries.filter((obj: object) => obj.hasOwnProperty('folderUri'));
				let workspaceInfo: IWorkspaceInfo[] = [];
				for (const f of folders) {
					let p, name, remote, pathExists, label;
					p = f.folderUri;
					name = path.basename(vscode.Uri.parse(f.folderUri).fsPath);
					if (f.label) {
						label = f.label;
						remote = true;
					} else {
						label = vscode.Uri.parse(f.folderUri).fsPath;
						remote = false;
						pathExists = fs.existsSync(label);
					}
					workspaceInfo.push({
						name: name,
						path: p,
						remote: remote,
						label: label,
						pathExists: pathExists,
					});
				}
				workspaceInfo ? resolve(workspaceInfo) : reject('Could not find any workspace info');
			});
		});
		db.close();
	});
}

function deleteWorkspace(vscdb: string, workspace: string[]): Promise<IWorkspaceInfo[]> {
	const db = new sqlite3.Database(vscdb);

	return new Promise<IWorkspaceInfo[]>((resolve, reject) => {
		db.get("SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'", (err, row: { value: string }) => {
			if (err) {
				reject(err);
			}
			const data = JSON.parse(row.value);

			// Filter the entries array
			data.entries = data.entries.filter((entry: { folderUri: string }) => !workspace.includes(entry.folderUri));

			// Save the modified object back to the ItemTable
			db.run("UPDATE ItemTable SET value = ? WHERE key = 'history.recentlyOpenedPathsList'", JSON.stringify(data), err => {
				if (err) {
					reject(err);
				}
				vscode.window.showInformationMessage('Successfully deleted workspace.');
			});

			const folders = data.entries.filter((obj: object) => obj.hasOwnProperty('folderUri'));
			let workspaceInfo: IWorkspaceInfo[] = [];
			for (const f of folders) {
				let p, name, remote, pathExists, label;
				p = f.folderUri;
				name = path.basename(vscode.Uri.parse(f.folderUri).fsPath);
				if (f.label) {
					label = f.label;
					remote = true;
				} else {
					label = vscode.Uri.parse(f.folderUri).fsPath;
					remote = false;
					pathExists = fs.existsSync(label);
				}
				workspaceInfo.push({
					name: name,
					path: p,
					remote: remote,
					label: label,
					pathExists: pathExists,
				});
			}
			workspaceInfo ? resolve(workspaceInfo) : reject('Could not find any workspace info');
		});
		db.close();
	});
}