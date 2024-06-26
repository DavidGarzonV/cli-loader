import process from 'node:process';
import * as ansiEscapes from './ansi-escapes';
import cliCursor from './cli-cursor';
import wrapAnsi from './wrap-ansi';
import sliceAnsi from './slice-ansi';
import stripAnsi from './strip-ansi';

const defaultTerminalHeight = 24;

const getWidth = ({ columns = 80 }: { columns?: number }) => columns;

const fitToTerminalHeight = (
	stream: NodeJS.WriteStream,
	text: string
): string => {
	const terminalHeight = stream.rows ?? defaultTerminalHeight;
	const lines = text.split('\n');
	const toRemove = Math.max(0, lines.length - terminalHeight);
	return toRemove
		? sliceAnsi(text, stripAnsi(lines.slice(0, toRemove).join('\n')).length + 1)
		: text;
};

interface LogUpdateOptions {
	showCursor?: boolean;
}

export type LogUpdateRender = {
	(...arguments_: string[]): void;
	clear(): void;
	done(): void;
};

export type LogUpdate = (...args: string[]) => LogUpdateRender;

export function createLogUpdate(stream: NodeJS.WriteStream,options: LogUpdateOptions = {}): LogUpdate {
	let previousLineCount = 0;
	let previousWidth = getWidth(stream);
	let previousOutput = '';

	const reset = () => {
		previousOutput = '';
		previousWidth = getWidth(stream);
		previousLineCount = 0;
	};

	const render = (...arguments_: string[]): LogUpdateRender => {
		if (!options.showCursor) {
			cliCursor.hide();
		}

		let output = fitToTerminalHeight(stream, arguments_.join(' ') + '\n');
		const width = getWidth(stream);

		if (output === previousOutput && previousWidth === width) {
			return render;
		}

		previousOutput = output;
		previousWidth = width;
		output = wrapAnsi(output, width, {
			trim: false,
			hard: true,
			wordWrap: false,
		});

		stream.write(ansiEscapes.eraseLines(previousLineCount) + output);
		previousLineCount = output.split('\n').length;

		return render;
	};

	render.message = '';

	render.clear = () => {
		stream.write(ansiEscapes.eraseLines(previousLineCount));
		reset();
	};

	render.previousOutput = previousOutput;

	render.done = () => {
		reset();
		if (!options.showCursor) {
			cliCursor.show();
		}
	};

	return render;
}

const logUpdate = createLogUpdate(process.stdout, { showCursor: false });
export default logUpdate;

export const logUpdateStderr = createLogUpdate(process.stderr);
