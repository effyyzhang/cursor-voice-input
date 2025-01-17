Requirements
	1.	Voice Input: Capture audio while holding a key, and transcribe it on release.
	2.	File Tree Context: Parse the file structure and match file names mentioned in voice input.
	3.	VS Code Integration: Interact with Cursor’s input field using VS Code APIs or system-level tools.

Tools and Technologies
	•	Speech-to-Text: Use OpenAI Whisper, Google Cloud Speech-to-Text, or the Web Speech API.
	•	File Tree Parsing: Use Node.js to scan the project directory for file names.
	•	Keyboard Events: Use Electron or Node.js with libraries like iohook for global key listening.
	•	Cursor Integration: Use Cursor’s API (if available) or VS Code’s extension APIs.