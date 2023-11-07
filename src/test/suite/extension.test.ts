import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as extension from '../../extension';
import path = require('path');

interface ITargetInfo {
	name: string;
	path: string;
	remote: boolean;
	label: string;
	pathExists?: boolean;
}

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	let extensionContext: vscode.ExtensionContext;
	suiteSetup(async () => {
		// Trigger extension activation and grab the context as some tests depend on it
		await vscode.extensions.getExtension('8LWXpg.vscdb-workspace-storage-cleanup')?.activate();
		extensionContext = (global as any).testExtensionContext;
	});

	test('UI test', () => {
		uiTest(extensionContext);
	});
});

async function uiTest(context: vscode.ExtensionContext) {
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

	// @ts-ignore
	panel.webview.html = await extension.getWebView(panel, context, Promise.resolve(testWorkspace));
	let input = await vscode.window.showInputBox();
}