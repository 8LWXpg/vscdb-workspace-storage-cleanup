import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as extension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	let extensionContext: vscode.ExtensionContext;
	suiteSetup(async () => {
		// Trigger extension activation and grab the context as some tests depend on it
		await vscode.extensions.getExtension('8LWXpg.vscdb-workspace-storage-cleanup')?.activate();
		extensionContext = (global as any).testExtensionContext;
	});

	test('UI test', () => {
		extension.uiTest(extensionContext);
	});
});
