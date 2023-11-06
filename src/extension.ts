import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as sqlite3 from '@vscode/sqlite3';

/**
 * describes the information related to a workspace or file.
 *
 * @interface
 * @property {string} name - The name of the workspace or file.
 * @property {string} path - The uri path of the workspace or file.
 * @property {boolean} remote - Indicates whether the workspace or file is remote.
 * @property {string} label - The label of the workspace or file, usually filesystem path or remote host.
 * @property {boolean} [pathExists] - Indicates whether the workspace or file path exists. This property is optional.
 */
interface ITargetInfo {
	name: string;
	path: string;
	remote: boolean;
	label: string;
	pathExists?: boolean;
}

export function activate(context: vscode.ExtensionContext) {
	(global as any).testExtensionContext = context;
	let currentPanels = {
		workspace: undefined as vscode.WebviewPanel | undefined,
		file: undefined as vscode.WebviewPanel | undefined
	};

	context.subscriptions.push(
		vscode.commands.registerCommand('vscdb-workspace-storage-cleanup.run', () => {
			const columnToShowIn = vscode.window.activeTextEditor
				? vscode.window.activeTextEditor.viewColumn
				: undefined;

			if (currentPanels.workspace) {
				currentPanels.workspace.reveal(columnToShowIn);
				return;
			}

			const globalStoragePath = path.dirname(context.globalStorageUri.fsPath);
			const vscdb = `${globalStoragePath}/state.vscdb`;

			currentPanels.workspace = vscode.window.createWebviewPanel(
				'table',
				'Workspace Cleanup',
				columnToShowIn || vscode.ViewColumn.One,
				{
					localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
					enableScripts: true,
				}
			);

			const updateWebView = (target: Promise<ITargetInfo[]>) => {
				if (!currentPanels.workspace) {
					return;
				}
				getWebView(currentPanels.workspace, context, target).then((html) => {
					if (!currentPanels.workspace) {
						return;
					}
					currentPanels.workspace.webview.html = html;
				});
			};

			updateWebView(getTargetInfo(vscdb));

			// Reset when the current panel is closed
			currentPanels.workspace.onDidDispose(
				() => {
					currentPanels.workspace = undefined;
				},
				null,
				context.subscriptions
			);

			currentPanels.workspace.webview.onDidReceiveMessage(
				message => {
					switch (message.command) {
						case 'delete':
							updateWebView(deleteTarget(vscdb, message.selectedWorkspaces));
							break;
						default:
							break;
					}
				}
			);
		}),
		vscode.commands.registerCommand('vscdb-workspace-storage-cleanup.file', () => {
			const columnToShowIn = vscode.window.activeTextEditor
				? vscode.window.activeTextEditor.viewColumn
				: undefined;

			if (currentPanels.file) {
				currentPanels.file.reveal(columnToShowIn);
				return;
			}

			const globalStoragePath = path.dirname(context.globalStorageUri.fsPath);
			const vscdb = `${globalStoragePath}/state.vscdb`;

			currentPanels.file = vscode.window.createWebviewPanel(
				'table',
				'Files Cleanup',
				columnToShowIn || vscode.ViewColumn.One,
				{
					localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
					enableScripts: true,
				}
			);

			const updateWebView = (targets: Promise<ITargetInfo[]>) => {
				if (!currentPanels.file) {
					return;
				}
				getWebView(currentPanels.file, context, targets).then((html) => {
					if (!currentPanels.file) {
						return;
					}
					currentPanels.file.webview.html = html;
				});
			};

			updateWebView(getTargetInfo(vscdb, 'fileUri'));

			// Reset when the current panel is closed
			currentPanels.file.onDidDispose(
				() => {
					currentPanels.file = undefined;
				},
				null,
				context.subscriptions
			);

			currentPanels.file.webview.onDidReceiveMessage(
				message => {
					switch (message.command) {
						case 'delete':
							updateWebView(deleteTarget(vscdb, message.selected, 'fileUri'));
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

async function getWebView(currentPanel: vscode.WebviewPanel, context: vscode.ExtensionContext, info: Promise<ITargetInfo[]>): Promise<string> {
	const scriptUri = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'webView.js'));
	const styleUri = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'style.css'));

	const tableRows = (await info).map((row) => {
		const icon = row.remote ? '🔗' : row.pathExists ? '✔️' : '❌';
		return /* html */`<tr>
	<td><input type="checkbox" remote="${row.remote}" exist="${row.remote || row.pathExists}" path="${row.path}"></td>
	<td>${row.name}</td>
	<td>${row.label}</td>
	<td>${icon}</td>
	<td>
		<a href="Delete" onclick="onDelete('${row.path}')"><i class="fa fa-trash-alt"></i></a>
	</td>
</tr>`;
	}).join('');

	return /* html */`<!DOCTYPE html>
<html lang="en">

<head>
	<link rel="stylesheet" href="${styleUri}">
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" integrity="sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74C1vSrLJxCq57o941Ym01SwNsOMqvEBFlcgUa6xLiPY/NS5R+E6ztJQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />
</head>

<body>
	<div class=sticky>
		<button onclick="onToggleAll()">Toggle all</button>
		<button onclick="onToggleMissing()">Toggle missing</button>
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
				<th>Delete</th>
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

function getTargetInfo(vscdb: string, property: string = 'folderUri'): Promise<ITargetInfo[]> {
	const db = new sqlite3.Database(vscdb);

	return new Promise<ITargetInfo[]>((resolve, reject) => {
		db.serialize(() => {
			db.get("SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'", (err: any, row: { value?: string }) => {
				if (err) {
					reject(err);
				}
				const value = row?.value ?? '';
				const parsedValue = JSON.parse(value);
				const infos = parsedValue.entries.filter((obj: object) => obj.hasOwnProperty(property));
				let targetInfo: ITargetInfo[] = [];
				for (const i of infos) {
					let p, name, remote, pathExists, label;
					p = i[property];
					name = path.basename(vscode.Uri.parse(i[property]).fsPath);
					if (i.label) {
						label = i.label;
						remote = true;
					} else {
						label = vscode.Uri.parse(i[property]).fsPath;
						remote = false;
						pathExists = fs.existsSync(label);
					}
					targetInfo.push({
						name: name,
						path: p,
						remote: remote,
						label: label,
						pathExists: pathExists,
					});
				}
				targetInfo ? resolve(targetInfo) : reject('Could not find any workspace info');
			});
		});
		db.close();
	});
}

function deleteTarget(vscdb: string, target: string[], type: string = 'folderUri'): Promise<ITargetInfo[]> {
	const db = new sqlite3.Database(vscdb);

	return new Promise<ITargetInfo[]>((resolve, reject) => {
		db.get("SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'", (err: any, row: { value: string }) => {
			if (err) {
				reject(err);
			}
			const data = JSON.parse(row.value);

			// Filter the entries array
			data.entries = data.entries.filter((entry: { [key: string]: string }) => !target.includes(entry[type]));

			// Save the modified object back to the ItemTable
			db.run("UPDATE ItemTable SET value = ? WHERE key = 'history.recentlyOpenedPathsList'", JSON.stringify(data), err => {
				if (err) {
					reject(err);
				}
				vscode.window.showInformationMessage('Successfully deleted workspace.');
			});

			const infos = data.entries.filter((obj: object) => obj.hasOwnProperty(type));
			let targetInfo: ITargetInfo[] = [];
			for (const i of infos) {
				let p, name, remote, pathExists, label;
				p = i[type];
				name = path.basename(vscode.Uri.parse(i[type]).fsPath);
				if (i.label) {
					label = i.label;
					remote = true;
				} else {
					label = vscode.Uri.parse(i[type]).fsPath;
					remote = false;
					pathExists = fs.existsSync(label);
				}
				targetInfo.push({
					name: name,
					path: p,
					remote: remote,
					label: label,
					pathExists: pathExists,
				});
			}
			targetInfo ? resolve(targetInfo) : reject('Could not find any workspace/file info');
		});
		db.close();
	});
}

// for making screenshots
export async function uiTest(context: vscode.ExtensionContext) {
	const testWorkspace: ITargetInfo[] = [
		{ name: 'temp1', label: 'd:\\temp\\temp1', path: 'file:///d%3A/temp/temp1', remote: false, pathExists: true },
		{ name: 'temp2', label: 'd:\\temp\\temp2', path: 'file:///d%3A/temp/temp2', remote: false, pathExists: true },
		{ name: 'temp3', label: 'd:\\temp\\temp3', path: 'file:///d%3A/temp/temp3', remote: false, pathExists: false },
		{ name: 'temp4', label: 'd:\\temp\\temp4', path: 'file:///d%3A/temp/temp4', remote: false, pathExists: true },
		{ name: 'temp5', label: 'd:\\temp\\temp5', path: 'file:///d%3A/temp/temp5', remote: false, pathExists: true },
		{ name: 'temp6', label: 'd:\\temp\\temp6', path: 'file:///d%3A/temp/temp6', remote: false, pathExists: true },
		{ name: 'temp7', label: 'd:\\temp\\temp7', path: 'file:///d%3A/temp/temp7', remote: false, pathExists: true },
		{ name: 'temp8', label: 'd:\\temp\\temp8', path: 'file:///d%3A/temp/temp8', remote: false, pathExists: false },
		{ name: 'temp9', label: 'd:\\temp\\temp9', path: 'file:///d%3A/temp/temp9', remote: false, pathExists: true },
		{ name: 'temp10', label: 'd:\\temp\\temp10', path: 'file:///d%3A/temp/temp10', remote: false, pathExists: true },
		{ name: 'temp4', label: 'D:\\temp\\temp4 [SSH: 192.168.0.16]', path: 'ssh-remote://', remote: true },
	];

	const panel = vscode.window.createWebviewPanel(
		'table',
		'Workspace Cleanup',
		vscode.ViewColumn.One,
		{
			localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
			enableScripts: true,
		}
	);

	panel.webview.html = await getWebView(panel, context, Promise.resolve(testWorkspace));
	vscode.window.showInformationMessage('screenshot');
}