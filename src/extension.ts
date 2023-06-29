import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as sqlite3 from 'better-sqlite3';

interface IWorkspaceInfo {
	name: string;
	path: string;
	remote: boolean;
	label: string;
	pathExists?: boolean;
}

export function activate(context: vscode.ExtensionContext) {
	(global as any).testExtensionContext = context;
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

function getWorkspaceInfo(vscdb: string): Promise<IWorkspaceInfo[]> {
	const db: sqlite3.Database = new sqlite3(vscdb);

	return new Promise<IWorkspaceInfo[]>((resolve, reject) => {
		const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'").get();
		// @ts-ignore
		const parsedValue = JSON.parse(row?.value);
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
		db.close();
	});
}

function deleteWorkspace(vscdb: string, workspace: string[]): Promise<IWorkspaceInfo[]> {
	const db: sqlite3.Database = new sqlite3(vscdb);

	return new Promise<IWorkspaceInfo[]>((resolve, reject) => {
		const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'").get();
		// @ts-ignore
		const parsedValue = JSON.parse(row?.value);
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
}

// for making screenshots
export async function uiTest(context: vscode.ExtensionContext) {
	const testWorkspace: IWorkspaceInfo[] = [
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