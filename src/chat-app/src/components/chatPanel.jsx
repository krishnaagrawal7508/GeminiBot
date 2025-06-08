import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { fileIcons } from '../utils/fileIcons.jsx';

const ChatPanel = () => {
    const inputRef = useRef(null);
    const messagesRef = useRef(null);

    const [isLoading, setIsLoading] = useState(false);
    const [apiKeySet, setApiKeySet] = useState(false);
    const [messages, setMessages] = useState([
        { text: 'how can I help you?', role: 'model' }
    ]);
    const [fileQuery, setFileQuery] = useState('');
    const [allFiles, setAllFiles] = useState([]);
    const [page, setPage] = useState(1);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const filesPerPage = 100;

    const vscode = window.vscode || window.acquireVsCodeApi?.();

    useEffect(() => {
        vscode?.postMessage({ command: 'checkApiKey' });
        window.addEventListener('message', handleVSCodeMessage);
        return () => window.removeEventListener('message', handleVSCodeMessage);
    }, []);

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
            console.log('Received files:', message.files);
            console.log('Received files:', message.files);
            setAllFiles(message.files || []);
            setPage(1);
            setSelectedIndex(0);
        }
    };

    useEffect(() => {
        messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
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
        inputRef.current.style.height = inputRef.current.scrollHeight + 'px';

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
        <div id="chat-container">
            {!apiKeySet ? (
                <div id="api-key-container" className="api-key-warning">
                    <h1>Welcome To GeminiBot</h1>
                    <p>AI-powered coding assistant, driven by Google's Gemini</p>
                    <img src="https://i.postimg.cc/SNkVRk6w/icon-no-BG.png" alt="icon" style={{ border: 0 }} />
                    <p>Please set your Gemini API key to use the chat feature.</p>
                    <button className="api-key-button" onClick={handleSetApiKey}>
                        Set API Key
                    </button>
                </div>
            ) : (
                <div id="chat-interface">
                    <div id="messages" ref={messagesRef}>
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`message ${msg.role}-message`}
                                dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }}
                            />
                        ))}
                        {isLoading && (
                            <div className="loading" id="loading-indicator">
                                Gemini is thinking
                                <div className="loading-dots">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div id="input-container">
                        <textarea
                            ref={inputRef}
                            id="message-input"
                            placeholder="Use @ to reference files ..."
                            rows={1}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                        />
                        <button id="send-button" onClick={sendMessage} disabled={isLoading}>Send</button>

                        {allFiles.length > 0 && (
                            <div id="file-suggestions">
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
                                {allFiles.length > filesPerPage && (
                                    <div className="file-pagination">
                                        <div className="file-pagination-text">
                                            Showing {(page - 1) * filesPerPage + 1}–
                                            {Math.min(page * filesPerPage, allFiles.length)} of {allFiles.length}
                                        </div>
                                        <div className="file-pagination-buttons">
                                            <button
                                                className="pagination-button prev-button"
                                                disabled={page === 1}
                                                onClick={() => changePage(-1)}
                                            >Prev</button>
                                            <button
                                                className="pagination-button next-button"
                                                disabled={page === Math.ceil(allFiles.length / filesPerPage)}
                                                onClick={() => changePage(1)}
                                            >Next</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatPanel;