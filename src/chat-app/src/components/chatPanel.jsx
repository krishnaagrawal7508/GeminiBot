import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { fileIcons } from '../utils/fileIcons.jsx';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const MessageContent = ({ content, vscode }) => {

    const renderer = new marked.Renderer();
    let codeBlockIndex = 0;

    renderer.code = (code, ) => {
        const id = `code-block-${codeBlockIndex++}`;

        const lang = hljs.getLanguage(code.lang) ? code.lang : 'text';

        const highlightedCode = hljs.highlight(code.text, { language: lang }).value;

        return `<div class="code-block-container" data-code="${encodeURIComponent(code)}" data-lang="${lang}" data-id="${id}">
            <div class="code-block-header">
                <span class="code-language">${lang}</span>
                <button class="copy-button" data-copy-id="${id}">Copy</button>
            </div>
            <pre><code class="language-${lang} hljs">${highlightedCode}</code></pre>
        </div>`;
    };

    marked.setOptions({
        renderer: renderer,
        breaks: true,
        gfm: true
    });

    const htmlContent = marked.parse(content);

    useEffect(() => {
        const timer = setTimeout(() => {

            // Attach copy button handlers
            const copyButtons = document.querySelectorAll('.code-block-container .copy-button');

            copyButtons.forEach((button,) => {
                button.onclick = null;

                button.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const container = button.closest('.code-block-container');
                    if (!container) {
                        console.error('Container not found');
                        return;
                    }

                    const codeElement = container.querySelector('pre code');
                    if (!codeElement) {
                        console.error('Code element not found');
                        return;
                    }

                    const escapedCode = codeElement.textContent;

                    if (vscode) {
                        vscode.postMessage({
                            command: 'copyToClipboard',
                            payload: escapedCode,
                        });
                    } else {
                        console.error('VSCode API not available');
                    }
                };
            });
        }, 300); // Increased timeout to 300ms for better DOM readiness

        return () => clearTimeout(timer);
    }, [htmlContent, vscode]);

    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

const ChatPanel = () => {
    const inputRef = useRef(null);
    const messagesRef = useRef(null);

    const [isLoading, setIsLoading] = useState(false);
    const [apiKeySet, setApiKeySet] = useState(false);
    const [messages, setMessages] = useState([
        { text: 'Hello! I\'m your AI coding assistant. How can I help you today?', role: 'model' }
    ]);
    const [, setFileQuery] = useState('');
    const [allFiles, setAllFiles] = useState([]);
    const [page, setPage] = useState(1);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const filesPerPage = 100;

    const vscode = window.vscode || window.acquireVsCodeApi?.();

    useEffect(() => {
        vscode?.postMessage({ command: 'checkApiKey' });
        window.addEventListener('message', handleVSCodeMessage);
        return () => window.removeEventListener('message', handleVSCodeMessage);
    },);

    const handleVSCodeMessage = (event) => {
        const { command, ...message } = event.data;
        if (command === 'apiKeyStatus') setApiKeySet(message.exists);
        else if (command === 'receiveMessage') addMessage(message.message, message.role);
        else if (command === 'startLoading') setIsLoading(true);
        else if (command === 'stopLoading') setIsLoading(false);
        else if (command === 'error') {
            showError(message.message);
            setIsLoading(false);
        } else if (command === 'clearChat') setMessages([]);
        else if (command === 'workspaceFiles') {
            setAllFiles(message.files || []);
            setPage(1);
            setSelectedIndex(0);
        }
    };

    useEffect(() => {
        messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const addMessage = (text, role) => {
        setMessages((prev) => [...prev, { text, role }]);
    };

    const showError = (text) => {
        addMessage(`❗ ${text}`, 'model');
    };

    const handleInputChange = (e) => {
        const text = e.target.value;
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';

        const cursor = inputRef.current.selectionStart;
        const beforeCursor = text.substring(0, cursor);
        const match = beforeCursor.match(/@([^@\s]*)$/);

        if (match) {
            const query = match[1];
            setFileQuery(query);
            vscode?.postMessage({ command: 'getWorkspaceFiles', query });
        } else {
            setAllFiles([]);
        }
    };

    const paginatedFiles = () => {
        const start = (page - 1) * filesPerPage;
        return allFiles.slice(start, start + filesPerPage);
    };

    const changePage = (delta) => {
        const totalPages = Math.ceil(allFiles.length / filesPerPage);
        setPage((prev) => {
            const nextPage = Math.min(Math.max(1, prev + delta), totalPages);
            setSelectedIndex(0);
            return nextPage;
        });
    };

    const navigateFileSuggestions = (direction) => {
        const currentFiles = paginatedFiles();
        const maxIndex = currentFiles.length - 1;
        let newIndex = selectedIndex + direction;

        if (newIndex < 0) {
            if (page > 1) {
                changePage(-1);
                setSelectedIndex(filesPerPage - 1);
            } else {
                setSelectedIndex(maxIndex);
            }
        } else if (newIndex > maxIndex) {
            if (page < Math.ceil(allFiles.length / filesPerPage)) {
                changePage(1);
                setSelectedIndex(0);
            } else {
                setSelectedIndex(0);
            }
        } else {
            setSelectedIndex(newIndex);
        }
    };

    const insertSelectedFile = () => {
        const file = paginatedFiles()[selectedIndex];
        if (!file) return;

        const input = inputRef.current;
        const text = input.value;
        const cursor = input.selectionStart;
        const before = text.substring(0, cursor);
        const after = text.substring(cursor);

        const match = before.match(/@([^@\s]*)$/);
        if (match) {
            const atIndex = before.lastIndexOf('@');
            const newText = before.substring(0, atIndex) + '@' + file.path + after;
            input.value = newText;
            input.focus();
            setAllFiles([]);
        }
    };

    const handleKeyDown = (e) => {
        if (allFiles.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateFileSuggestions(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateFileSuggestions(-1);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertSelectedFile();
            } else if (e.key === 'Escape') {
                setAllFiles([]);
            }
        }

        if (e.key === 'Enter' && !e.shiftKey && allFiles.length === 0) {
            e.preventDefault();
            sendMessage();
        }
    };

    const sendMessage = () => {
        const text = inputRef.current.value.trim();
        if (!text || isLoading) return;

        addMessage(text, 'user');
        vscode?.postMessage({ command: 'sendMessage', text });
        inputRef.current.value = '';
        inputRef.current.style.height = 'auto';
        setAllFiles([]);
    };

    const getFileIcon = (path) => {
        const ext = path.split('.').pop();
        return fileIcons[ext] || fileIcons.default;
    };

    const handleSetApiKey = () => {
        vscode?.postMessage({ command: 'setApiKey' });
    };

    return (
        <div className="chat-panel">
            {!apiKeySet ? (
                <div className="welcome-screen">
                    <div className="welcome-content">
                        <h1>Welcome to GeminiBot</h1>
                        <p>AI-powered coding assistant</p>
                        <img src="https://i.postimg.cc/SNkVRk6w/icon-no-BG.png" alt="icon" style={{ border: 0 }} />
                        <p>Please set your Gemini API key to use the chat feature.</p>
                        <button className="setup-button" onClick={handleSetApiKey}>
                            Set API Key
                        </button>
                    </div>
                </div>
            ) : (
                <div className="chat-interface">
                    <div className="messages-container" ref={messagesRef}>
                        {messages.map((msg, i) => (
                            <div key={i} className={`message-wrapper ${msg.role}`}>
                                <div className="message-avatar">
                                    {msg.role === 'user' ? (
                                        <div className="user-avatar">U</div>
                                    ) : (
                                        <div className="bot-avatar">AI</div>
                                    )}
                                </div>
                                <div className="message-content">
                                    <MessageContent content={msg.text} vscode={vscode} />
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="message-wrapper model">
                                <div className="message-avatar">
                                    <div className="bot-avatar">AI</div>
                                </div>
                                <div className="thinking-indicator">
                                    <div className="thinking-dots">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="input-area">
                        {allFiles.length > 0 && (
                            <div className="file-suggestions">
                                {paginatedFiles().map((file, i) => (
                                    <div
                                        key={i}
                                        className={`file-suggestion ${i === selectedIndex ? 'selected' : ''}`}
                                        onClick={() => {
                                            setSelectedIndex(i);
                                            insertSelectedFile();
                                        }}
                                    >
                                        <div className="file-icon" dangerouslySetInnerHTML={{ __html: getFileIcon(file.path) }}></div>
                                        <div className="file-path">{file.path}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="input-container">
                            <textarea
                                ref={inputRef}
                                className="message-input"
                                placeholder="Ask me anything about your code..."
                                rows={1}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                            />
                            <button
                                className={`send-button ${isLoading ? 'disabled' : ''}`}
                                onClick={sendMessage}
                                disabled={isLoading}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatPanel;