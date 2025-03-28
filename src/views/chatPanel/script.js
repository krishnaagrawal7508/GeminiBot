(function () {
    const vscode = acquireVsCodeApi();

    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const apiKeyContainer = document.getElementById('api-key-container');
    const chatInterface = document.getElementById('chat-interface');
    const setApiKeyButton = document.getElementById('set-api-key');
    const fileSuggestions = document.getElementById('file-suggestions');

    let isLoading = false;
    let fileSearchTimeout = null;
    let currentFilePage = 1;
    let totalFilePages = 1;
    let allFiles = [];
    let filesPerPage = 100;

    const fileIcons = {
        'js': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#F0DB4F" d="M3 3h18v18H3V3m4.73 15.04c.4.85 1.19 1.55 2.54 1.55 1.5 0 2.53-.8 2.53-2.55v-5.78h-1.7V17c0 .86-.35 1.08-.9 1.08-.58 0-.82-.4-1.09-.87l-1.38.83m5.98-.18c.5.98 1.51 1.73 3.09 1.73 1.6 0 2.8-.83 2.8-2.36 0-1.41-.81-2.04-2.25-2.66l-.42-.18c-.73-.31-1.04-.52-1.04-1.02 0-.41.31-.73.81-.73.48 0 .8.21 1.09.73l1.31-.87c-.55-.96-1.33-1.33-2.4-1.33-1.51 0-2.48.96-2.48 2.23 0 1.38.81 2.03 2.03 2.55l.42.18c.78.34 1.24.55 1.24 1.13 0 .48-.45.83-1.15.83-.83 0-1.31-.43-1.67-1.03l-1.38.8z"/></svg>',
        'ts': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#3178C6" d="M3,3H21V21H3V3M13.71,17.86C14.21,18.84,15.22,19.59,16.8,19.59C18.4,19.59,19.6,18.76,19.6,17.23C19.6,15.82,18.79,15.19,17.35,14.57L16.93,14.39C16.2,14.08,15.89,13.87,15.89,13.37C15.89,12.96,16.2,12.64,16.7,12.64C17.18,12.64,17.5,12.85,17.79,13.37L19.1,12.5C18.55,11.54,17.77,11.17,16.7,11.17C15.19,11.17,14.22,12.13,14.22,13.4C14.22,14.78,15.03,15.43,16.25,15.95L16.67,16.13C17.45,16.47,17.91,16.68,17.91,17.26C17.91,17.74,17.46,18.09,16.76,18.09C15.93,18.09,15.45,17.66,15.09,17.06L13.71,17.86M13,11.25H8V12.75H9.5V20H11.25V12.75H13V11.25Z"/></svg>',
        'jsx': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#61DAFB" d="M12,10.11C13.03,10.11 13.87,10.95 13.87,12C13.87,13 13.03,13.85 12,13.85C10.97,13.85 10.13,13 10.13,12C10.13,10.95 10.97,10.11 12,10.11M7.37,20C8,20.38 8.67,20.75 9.4,21C13.3,19.5 15.8,16.13 16.43,12C15.8,7.87 13.34,4.5 9.4,3C8.67,3.25 8,3.63 7.37,4C7.87,4.5 8.34,5 8.8,5.5C10.4,4.5 12.13,5.5 12.57,5.75C13.93,7 15.28,9.5 15.83,12C15.28,14.5 13.93,17 12.57,18.25C12.13,18.5 10.4,19.5 8.8,18.5C8.34,19 7.87,19.5 7.37,20M7.36,4C6.73,4.38 6.13,4.84 5.59,5.32C4.43,6.29 3.5,7.45 2.83,8.7C4.07,11 4.07,13 2.83,15.3C3.5,16.55 4.43,17.71 5.59,18.68C6.13,19.16 6.73,19.62 7.36,20C6.5,19.5 5.66,19 4.87,18.37C4.59,18.19 4.33,18 4.06,17.8C1.55,15.92 0,14.09 0,12C0,9.91 1.55,8.08 4.06,6.2C4.33,6 4.59,5.81 4.87,5.63C5.66,5 6.5,4.5 7.36,4M16.64,4C17.5,4.5 18.34,5 19.13,5.63C19.41,5.81 19.67,6 19.94,6.2C22.45,8.08 24,9.91 24,12C24,14.09 22.45,15.92 19.94,17.8C19.67,18 19.41,18.19 19.13,18.37C18.34,19 17.5,19.5 16.64,20C17.27,19.62 17.87,19.16 18.41,18.68C19.57,17.71 20.5,16.55 21.17,15.3C19.93,13 19.93,11 21.17,8.7C20.5,7.45 19.57,6.29 18.41,5.32C17.87,4.84 17.27,4.38 16.64,4M12,2C14.75,2 17.1,3 19.05,4.63C18.67,4.94 18.31,5.25 17.96,5.59C16.31,4.15 14.28,3.35 12,3.35C9.72,3.35 7.69,4.15 6.04,5.59C5.69,5.25 5.33,4.94 4.95,4.63C6.9,3 9.25,2 12,2Z"/></svg>',
        'tsx': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#3178C6" d="M20.13,4.96C19,4.34 17.75,4 16.47,4C14.3,4 12.15,4.85 10.87,6.55C10.67,6.81 10.5,7.09 10.35,7.38C10.33,7.36 10.3,7.34 10.27,7.33C9,6.54 7.75,6.16 6.53,6.16C5.86,6.16 5.21,6.27 4.58,6.46C3.95,6.68 3.35,7 2.82,7.41C2.29,7.83 1.84,8.33 1.49,8.91C1.14,9.5 0.88,10.16 0.73,10.87C0.58,11.58 0.53,12.35 0.57,13.17C0.61,13.98 0.76,14.83 1.03,15.7C1.29,16.57 1.68,17.47 2.19,18.39C2.71,19.31 3.37,20.25 4.19,21.2L2.63,22.69L3.77,23.83L5.25,22.35C5.69,22.73 6.14,23.08 6.61,23.41C7.04,23.75 7.5,24.05 7.97,24.32L8.39,24.53L8.69,24.68C9.85,25.24 11.06,25.5 12.3,25.5C13.94,25.5 15.62,25.06 17.34,24.15C19.06,23.25 20.82,21.85 22.61,20.06L22.5,19.96L24.08,18.35L22.94,17.21L21.44,18.71C19.84,20.33 18.31,21.59 16.84,22.5C15.38,23.41 14.03,23.86 12.81,23.86C11.79,23.86 10.83,23.64 9.91,23.2L9.65,23.06L9.27,22.87C8.8,22.62 8.4,22.35 8.07,22.07C7.38,21.5 6.77,20.83 6.21,20.07C5.65,19.31 5.16,18.47 4.73,17.58C4.3,16.69 3.96,15.74 3.69,14.77C3.43,13.8 3.3,12.78 3.3,11.75C3.3,11.38 3.33,11 3.39,10.63C3.45,10.25 3.54,9.89 3.67,9.52C3.8,9.16 3.96,8.82 4.19,8.48C4.4,8.15 4.66,7.85 4.96,7.57C5.27,7.29 5.59,7.07 5.96,6.89C6.32,6.71 6.71,6.62 7.14,6.62C7.39,6.62 7.64,6.67 7.88,6.76C8.12,6.85 8.36,6.98 8.59,7.15C8.82,7.32 9.04,7.53 9.25,7.77C9.46,8.01 9.65,8.28 9.83,8.58L10.92,7.43C10.96,7.37 11,7.32 11.06,7.25C12.05,5.96 13.5,5.31 15.42,5.31C16.38,5.31 17.37,5.61 18.37,6.21C19.38,6.82 20.4,7.77 21.44,9.07L22.64,8L21.5,6.86C20.69,5.92 19.75,5.19 18.69,4.73L20.13,4.96Z"/></svg>',

        // Web Languages
        'html': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#E44D26" d="M12,17.56L16.07,16.43L16.62,10.33H9.38L9.2,8.3H16.8L17,6.31H7L7.56,12.32H14.45L14.22,14.9L12,15.5L9.78,14.9L9.64,13.24H7.64L7.93,16.43L12,17.56M4.07,3H19.93L18.5,19.2L12,21L5.5,19.2L4.07,3Z"/></svg>',
        'css': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#1572B6" d="M5,3L4.35,6.34H17.94L17.5,8.5H3.92L3.26,11.83H16.85L16.09,15.64L10.61,17.45L5.86,15.64L6.19,14H2.85L2.06,18L9.91,21L18.96,18L20.16,11.97L20.4,10.76L21.94,3H5Z"/></svg>',
        'scss': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#CD6799" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M15.54,15.89C15.88,15.54 16.04,15.14 16.01,14.76C15.97,14.29 15.73,13.89 15.33,13.53C15.24,13.46 15.14,13.39 15.03,13.32C16.02,12.39 16.32,11.62 16.13,11C15.9,10.1 14.83,9.86 13.79,10.06C13.87,9.67 13.92,9.42 13.87,9.26C13.65,8.35 11.77,8.45 10.93,9.17C10.09,9.87 9.94,10.71 10.11,11.11C10.44,11.82 11.14,12.36 11.85,12.74C10.97,13.36 9.92,14.22 9.58,15C9.21,15.82 9.35,16.45 9.54,16.77C10.04,17.47 11.22,17.47 11.92,16.95C12.62,16.43 12.87,15.62 12.63,14.61C13.3,14.33 14.14,14.23 15.01,14.42C15.63,14.55 15.97,15.23 15.54,15.89M11.89,16.08C11.4,16.44 10.8,16.3 10.57,15.95C10.36,15.59 10.57,15.14 10.86,14.84C11.06,14.62 11.66,14.12 11.91,13.91L12.25,13.71C12.35,13.66 12.35,13.66 12.44,13.61C12.59,13.71 12.74,13.81 12.88,13.92C13.25,14.2 13.71,14.64 13.71,15.12C13.73,15.83 12.3,15.77 11.89,16.08M12.2,11.31C11.71,10.97 11.33,10.59 11.25,10.21C11.17,9.88 11.42,9.59 11.79,9.5C12.13,9.47 12.56,9.62 12.78,9.84C13.27,10.32 13.16,10.86 12.2,11.31M15.21,14.06C14.67,13.91 13.9,14.04 13.36,14.21L13.13,14.29C13.16,14.16 13.18,14.04 13.2,13.91C13.28,13.57 13.27,13.21 13.16,12.86C13.43,12.59 13.95,12.33 14.31,12.27C15.11,12.2 15.47,13.38 15.21,14.06Z"/></svg>',
        'json': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#8BC34A" d="M5,3H7V5H5V10A2,2 0 0,1 3,12A2,2 0 0,1 5,14V19H7V21H5C3.93,20.73 3,20.1 3,19V15A2,2 0 0,0 1,13H0V11H1A2,2 0 0,0 3,9V5A2,2 0 0,1 5,3M19,3A2,2 0 0,1 21,5V9A2,2 0 0,0 23,11H24V13H23A2,2 0 0,0 21,15V19A2,2 0 0,1 19,21H17V19H19V14A2,2 0 0,1 21,12A2,2 0 0,1 19,10V5H17V3H19M12,15A1,1 0 0,1 13,16A1,1 0 0,1 12,17A1,1 0 0,1 11,16A1,1 0 0,1 12,15M8,15A1,1 0 0,1 9,16A1,1 0 0,1 8,17A1,1 0 0,1 7,16A1,1 0 0,1 8,15M16,15A1,1 0 0,1 17,16A1,1 0 0,1 16,17A1,1 0 0,1 15,16A1,1 0 0,1 16,15Z"/></svg>',

        // Programming Languages
        'py': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#3776AB" d="M19.14,7.5A2.86,2.86 0 0,1 22,10.36V14.14A2.86,2.86 0 0,1 19.14,17H12C12,17.39 12.32,17.96 12.71,17.96H17V19.64A2.86,2.86 0 0,1 14.14,22.5H9.86A2.86,2.86 0 0,1 7,19.64V15.89C7,14.31 8.28,13.04 9.86,13.04H15.11C16.69,13.04 17.96,11.76 17.96,10.18V7.5H19.14M14.86,19.29C14.46,19.29 14.14,19.59 14.14,20.18C14.14,20.77 14.46,20.89 14.86,20.89A0.71,0.71 0 0,0 15.57,20.18C15.57,19.59 15.25,19.29 14.86,19.29M4.86,17.5C3.28,17.5 2,16.22 2,14.64V10.86C2,9.28 3.28,8 4.86,8H12C12,7.61 11.68,7.04 11.29,7.04H7V5.36C7,3.78 8.28,2.5 9.86,2.5H14.14C15.72,2.5 17,3.78 17,5.36V9.11C17,10.69 15.72,11.96 14.14,11.96H8.89C7.31,11.96 6.04,13.24 6.04,14.82V17.5H4.86M9.14,5.71C9.54,5.71 9.86,5.41 9.86,4.82C9.86,4.23 9.54,4.11 9.14,4.11C8.75,4.11 8.43,4.23 8.43,4.82C8.43,5.41 8.75,5.71 9.14,5.71Z"/></svg>',
        'java': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#007396" d="M9.37,17.51c-3.09.86-6.27.92-6.34,1.73-.82-1,8.27-2.75,13.45-7.67-2,4.93-7.11,5.94-7.11,5.94m.53-3.28c-.63,1-.7,1.38-1.36,2.2,0,0,3.14-.74,6.3-2.2,1-.55,3.19-1.44,4-2.33C14.96,15.83,9.9,14.23,9.9,14.23m9.88-8.7L17,4l-1.37.33c0,.24,5.24,2.58,6.15,5.56,0,0-1.56-3.5-5.9-5.47-2.18-.9-3.59-1.73-5.92-1.32,0,0,2.19,1.4,3.14,2.27.95.72,4.09,3,6.37,8.36,0,0-1.39-6.32-7-10.69,1.69.12,2.94.14,2.94.14s-1.43-.61-3.28-.93c.59-.23,1.08-.43,1.08-.43.54-.3,3.59-.24,4.63.02-.8-.42-4.15-.56-6.8.35-1.08.91-2,1.68-2,1.68s.95-.73,3.35-1.68c-.92.26-2.91,1.43-3.28,1.62-3.59,2-6,5.92-9.13,10.28,0,0,2.94-3.81,7.94-7.22,0,0-2.55,1.5-4.86,4.33,0,0,3.82-5.52,10.31-7.19,0,0,1.67-.45,3.28-.5-.52-.3-2.41-.06-2.41-.06"/></svg>',
        'c': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#283593" d="M16,6.82L18.25,9L18.07,9.19L16,11L15.2,10.2L15.93,9.33L12.25,9.33L5.5,15.5L3,15.5L3,8.5L5.5,8.5L12.25,14.67L15.93,14.67L15.2,13.8L16,13L18.07,15L18.25,15.19L16,18C13.33,18 14.92,18 14.92,18L10.75,13.83L5.17,13.83L5.17,10.17L10.75,10.17L14.92,6C14.92,6 13.33,6 16,6.82Z"/></svg>',
        'cpp': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#00599C" d="M10.5,15.97L10.91,18.41C10.65,18.55 10.23,18.68 9.67,18.8C9.1,18.93 8.43,19 7.66,19C5.45,18.96 3.79,18.3 2.68,17.04C1.56,15.77 1,14.16 1,12.21C1.05,9.9 1.72,8.13 3,6.89C4.32,5.64 5.96,5 7.94,5C8.69,5 9.34,5.07 9.88,5.19C10.42,5.31 10.82,5.44 11.08,5.59L10.5,8.08L9.44,7.74C9.04,7.64 8.58,7.59 8.05,7.59C6.89,7.58 5.93,7.95 5.18,8.69C4.42,9.42 4.03,10.54 4,12.03C4,13.39 4.37,14.45 5.08,15.23C5.79,16 6.79,16.4 8.07,16.41L9.4,16.29C9.83,16.21 10.19,16.1 10.5,15.97M11,11H13V9H15V11H17V13H15V15H13V13H11V11M18,11H20V9H22V11H24V13H22V15H20V13H18V11Z"/></svg>',
        'cs': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#67217A" d="M11.5,15.97L11.91,18.41C11.65,18.55 11.23,18.68 10.67,18.8C10.1,18.93 9.43,19 8.66,19C6.45,18.96 4.79,18.3 3.68,17.04C2.56,15.77 2,14.16 2,12.21C2.05,9.9 2.72,8.13 4,6.89C5.32,5.64 6.96,5 8.94,5C9.69,5 10.34,5.07 10.88,5.19C11.42,5.31 11.82,5.44 12.08,5.59L11.5,8.08L10.44,7.74C10.04,7.64 9.58,7.59 9.05,7.59C7.89,7.58 6.93,7.95 6.18,8.69C5.42,9.42 5.03,10.54 5,12.03C5,13.39 5.37,14.45 6.08,15.23C6.79,16 7.79,16.4 9.07,16.41L10.4,16.29C10.83,16.21 11.19,16.1 11.5,15.97M13.89,19L14.5,15H13L13.34,13H14.84L15.16,11H13.66L14,9H15.5L16.11,5H18.11L17.5,9H19L19.61,5H21.61L21,9H22.5L22.16,11H20.66L20.34,13H21.84L21.5,15H20L19.39,19H17.39L18,15H16.5L15.89,19H13.89M16.84,13H18.34L18.66,11H17.16L16.84,13Z"/></svg>',
        'go': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#00ACD7" d="M2.61,13.93H1.91c-.06,0-.11-.07-.11-.14v-.4c0-.08.05-.14.11-.14H3.5c.06,0,.11.07.11.14V13.8a.18.18,0,0,1-.06.14,2.64,2.64,0,0,0-.79,2.45c.11.58.41,1.15,1.2,1.3a2.18,2.18,0,0,0,2.3-1,.53.53,0,0,1,.1-.15c.06,0,.09,0,.11,0L7,16.85a.11.11,0,0,1,.08.08,2.24,2.24,0,0,1-.52.89,3.05,3.05,0,0,1-2.5,1.11c-1.31,0-2.2-.67-2.63-1.3A3.25,3.25,0,0,1,1,15.24,3.39,3.39,0,0,1,2.61,13.93Zm4.39-2.31,1.35-1.54L12.9,7.33a.11.11,0,0,1,.14,0l2.77,1.75a.15.15,0,0,1,0,.21l-.73.63a.11.11,0,0,1-.14,0L12,8.68,9.87,11.13l-1.51,1.69A.13.13,0,0,1,8.26,13,3.44,3.44,0,0,0,7,11.59Zm3.56,2.78a.14.14,0,0,1,.11-.14h.35A.14.14,0,0,1,11.13,14c0,2.31.58,2.46,2.07,2.46H15c.07,0,.11.07.11.14v.4c0,.08,0,.14-.11.14H13.1c-2.16,0-2.54-1-2.54-3.17ZM19,13.88a.15.15,0,0,1,.14.14v.4a.15.15,0,0,1-.14.15h-.28A1.47,1.47,0,0,0,17,15.9v1.56a.15.15,0,0,1-.14.14h-.4a.15.15,0,0,1-.14-.14v-3.3a.14.14,0,0,1,.14-.14h.4a.14.14,0,0,1,.14.14V14c.3-.14.81-.28,1.06-.28H19ZM21.63,6.4a.14.14,0,0,1,.14.14v.41a.14.14,0,0,1-.14.13h-4.9a.14.14,0,0,1-.14-.13V6.54a.14.14,0,0,1,.14-.14h1.17V5.21c0-.06.07-.09.15-.09h.4a.15.15,0,0,1,.15.13v1.2ZM21.63,9a.15.15,0,0,1,.14.15v.4a.15.15,0,0,1-.14.14H15.7a.14.14,0,0,1-.14-.14v-.4A.14.14,0,0,1,15.7,9ZM21.63,4a.14.14,0,0,1,.14.14v.45a.14.14,0,0,1-.14.14H15.7a.14.14,0,0,1-.14-.14V4.09a.14.14,0,0,1,.14-.14Zm-4.11,4.32c.06,0,.09,0,.09.08a1.24,1.24,0,0,1-.23.55.15.15,0,0,1-.11.09h-.44a.17.17,0,0,1-.14-.09,1.24,1.24,0,0,1-.23-.55.08.08,0,0,1,.09-.08Zm-.52,1.75a.13.13,0,0,1,.14.14V17.47a.14.14,0,0,1-.14.14H16.6a.14.14,0,0,1-.14-.14V14.1h-1a.14.14,0,0,1-.14-.14v-.33a.14.14,0,0,1,.14-.14h1V11.91H15.35a.14.14,0,0,1-.14-.14v-.4a.14.14,0,0,1,.14-.14h1.18V10.05ZM11.16,5.21a.13.13,0,0,1,.14-.13h1.45a.29.29,0,0,1,.14.07,3.19,3.19,0,0,1,.63,1,3.8,3.8,0,0,1,.49,1.82,3.91,3.91,0,0,1-.47,1.81,4.37,4.37,0,0,1-.65,1A.22.22,0,0,1,12.78,11l-1.48,0a.13.13,0,0,1-.14-.15Z"/></svg>',
        'rust': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#000000" d="M23.687,11.709l-.995-.616a13.559,13.559,0,0,0-.028-1.389l.855-.779a.344.344,0,0,0,.088-.363,11.99,11.99,0,0,0-1.069-2.56.342.342,0,0,0-.323-.179l-1.136.047a12.582,12.582,0,0,0-.743-1.239l.594-1a.343.343,0,0,0-.05-.372,12.182,12.182,0,0,0-2.028-1.983.344.344,0,0,0-.376-.038l-.973.462a12.325,12.325,0,0,0-1.177-.622L16.046.886a.344.344,0,0,0-.185-.321,12.057,12.057,0,0,0-2.7-.754.345.345,0,0,0-.35.138l-.63.795a14.5,14.5,0,0,0-1.371,0l-.615-.779a.346.346,0,0,0-.349-.142,12.026,12.026,0,0,0-2.7.741.344.344,0,0,0-.188.32l.027,1.06a12.34,12.34,0,0,0-1.186.613l-.964-.456a.346.346,0,0,0-.376.035,12.149,12.149,0,0,0-2.039,1.972.345.345,0,0,0-.051.373l.589.994a12.694,12.694,0,0,0-.751,1.236l-1.124-.047a.353.353,0,0,0-.326.177A12.148,12.148,0,0,0,.244,8.306a.345.345,0,0,0,.089.364l.845.77a13.4,13.4,0,0,0-.033,1.391l-.985.616a.344.344,0,0,0-.15.342,12.05,12.05,0,0,0,.681,2.67.342.342,0,0,0,.287.223l1.119.096a11.893,11.893,0,0,0,.787,1.271l-.537,1.025a.343.343,0,0,0,.016.377,12.118,12.118,0,0,0,1.748,2.209.343.343,0,0,0,.368.089l1.012-.365a11.9,11.9,0,0,0,1.153.659l-.114,1.076a.342.342,0,0,0,.173.33,12.063,12.063,0,0,0,2.665.777.348.348,0,0,0,.334-.122l.655-.773a14.6,14.6,0,0,0,1.371,0l.641.773a.341.341,0,0,0,.333.125,12.008,12.008,0,0,0,2.667-.762.342.342,0,0,0,.174-.329l-.108-1.077a11.923,11.923,0,0,0,1.15-.657l1.022.369a.339.339,0,0,0,.368-.089,12.087,12.087,0,0,0,1.754-2.219.346.346,0,0,0,.016-.375l-.544-1.027a11.877,11.877,0,0,0,.786-1.273l1.126-.098a.343.343,0,0,0,.287-.225,12.049,12.049,0,0,0,.68-2.668A.347.347,0,0,0,23.687,11.709ZM19.9,13.9a.686.686,0,0,1-.368.9.679.679,0,0,1-.9-.365,7.634,7.634,0,0,0-13.67-.019.682.682,0,0,1-1.266-.5A8.989,8.989,0,0,1,19.9,13.9Zm-13.7-4.9a2.965,2.965,0,0,1,3.85-1.59,2.774,2.774,0,0,1,1.548,3.634A2.779,2.779,0,0,1,6.2,9Z"/></svg>',
        'scala': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#DC322F" d="M4.531,12C4.453,12 4.375,11.977 4.336,11.93A0.143,0.143 0,0,1 4.336,11.734C4.336,11.734 5.109,10.344 8.609,8.953C12.109,7.563 18.797,7.5 18.797,7.5C18.891,7.5 18.984,7.594 18.984,7.688C18.984,7.781 18.891,7.875 18.797,7.875C18.797,7.875 12.188,7.922 8.766,9.273C5.344,10.625 4.609,11.938 4.609,11.938C4.57,11.977 4.57,11.977 4.531,12M4.531,15C4.453,15 4.375,14.977 4.336,14.93A0.143,0.143 0,0,1 4.336,14.734C4.336,14.734 5.109,13.344 8.609,11.953C12.109,10.563 18.797,10.5 18.797,10.5C18.891,10.5 18.984,10.594 18.984,10.688C18.984,10.781 18.891,10.875 18.797,10.875C18.797,10.875 12.188,10.922 8.766,12.273C5.344,13.625 4.609,14.938 4.609,14.938C4.57,14.977 4.57,14.977 4.531,15M4.531,9C4.453,9 4.375,8.977 4.336,8.93A0.143,0.143 0,0,1 4.336,8.734C4.336,8.734 5.109,7.344 8.609,5.953C12.109,4.563 18.797,4.5 18.797,4.5C18.891,4.5 18.984,4.594 18.984,4.688C18.984,4.781 18.891,4.875 18.797,4.875C18.797,4.875 12.188,4.922 8.766,6.273C5.344,7.625 4.609,8.938 4.609,8.938C4.57,8.977 4.57,8.977 4.531,9M4.531,18C4.453,18 4.375,17.977 4.336,17.93A0.143,0.143 0,0,1 4.336,17.734C4.336,17.734 5.109,16.344 8.609,14.953C12.109,13.563 18.797,13.5 18.797,13.5C18.891,13.5 18.984,13.594 18.984,13.688C18.984,13.781 18.891,13.875 18.797,13.875C18.797,13.875 12.188,13.922 8.766,15.273C5.344,16.625 4.609,17.938 4.609,17.938C4.57,17.977 4.57,17.977 4.531,18Z"/></svg>',

        // Document Formats
        'md': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#42A5F5" d="M20.56 18H3.44C2.65 18 2 17.37 2 16.58V7.42C2 6.63 2.65 6 3.44 6H20.56C21.35 6 22 6.63 22 7.42V16.58C22 17.37 21.35 18 20.56 18M6.81 15.19V11.53L8.73 13.88L10.65 11.53V15.19H12.58V8.81H10.65L8.73 11.16L6.81 8.81H4.89V15.19H6.81M18.79 10.73H16.86V8.81H15.39V10.73H13.47V12.2H15.39V14.12H16.86V12.2H18.79V10.73Z"/></svg>',
        'txt': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#607D8B" d="M14,17H7V15H14M17,13H7V11H17M17,9H7V7H17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z"/></svg>',
        'pdf': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#F44336" d="M20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H8V4H20V16M4,6H2V20A2,2 0 0,0 4,22H18V20H4V6M16,12V9H13V12H10L15,17L20,12H16Z"/></svg>',
        'docx': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#F44336" d="M20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H8V4H20V16M4,6H2V20A2,2 0 0,0 4,22H18V20H4V6M16,12V9H13V12H10L15,17L20,12H16Z"/></svg>',

        // Data & Configuration
        'xml': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#FF5722" d="M12.89,3L14.85,3.4L11.11,21L9.15,20.6L12.89,3M19.59,12L16,8.41V5.58L22.42,12L16,18.41V15.58L19.59,12M1.58,12L8,5.58V8.41L4.41,12L8,15.58V18.41L1.58,12Z"/></svg>',
        'yml': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#FFCA28" d="M5,3H7V5H5V10A2,2 0 0,1 3,12A2,2 0 0,1 5,14V19H7V21H5C3.93,20.73 3,20.1 3,19V15A2,2 0 0,0 1,13H0V11H1A2,2 0 0,0 3,9V5A2,2 0 0,1 5,3M19,3A2,2 0 0,1 21,5V9A2,2 0 0,0 23,11H24V13H23A2,2 0 0,0 21,15V19A2,2 0 0,1 19,21H17V19H19V14A2,2 0 0,1 21,12A2,2 0 0,1 19,10V5H17V3H19M12,15A1,1 0 0,1 13,16A1,1 0 0,1 12,17A1,1 0 0,1 11,16A1,1 0 0,1 12,15M8,15A1,1 0 0,1 9,16A1,1 0 0,1 8,17A1,1 0 0,1 7,16A1,1 0 0,1 8,15M16,15A1,1 0 0,1 17,16A1,1 0 0,1 16,17A1,1 0 0,1 15,16A1,1 0 0,1 16,15Z"/></svg>',
        'yaml': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#FFCA28" d="M5,3H7V5H5V10A2,2 0 0,1 3,12A2,2 0 0,1 5,14V19H7V21H5C3.93,20.73 3,20.1 3,19V15A2,2 0 0,0 1,13H0V11H1A2,2 0 0,0 3,9V5A2,2 0 0,1 5,3M19,3A2,2 0 0,1 21,5V9A2,2 0 0,0 23,11H24V13H23A2,2 0 0,0 21,15V19A2,2 0 0,1 19,21H17V19H19V14A2,2 0 0,1 21,12A2,2 0 0,1 19,10V5H17V3H19M12,15A1,1 0 0,1 13,16A1,1 0 0,1 12,17A1,1 0 0,1 11,16A1,1 0 0,1 12,15M8,15A1,1 0 0,1 9,16A1,1 0 0,1 8,17A1,1 0 0,1 7,16A1,1 0 0,1 8,15M16,15A1,1 0 0,1 17,16A1,1 0 0,1 16,17A1,1 0 0,1 15,16A1,1 0 0,1 16,15Z"/></svg>',
        'sql': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#03A9F4" d="M12,3C7.58,3 4,4.79 4,7C4,9.21 7.58,11 12,11C16.42,11 20,9.21 20,7C20,4.79 16.42,3 12,3M4,9V12C4,14.21 7.58,16 12,16C16.42,16 20,14.21 20,12V9C20,11.21 16.42,13 12,13C7.58,13 4,11.21 4,9M4,14V17C4,19.21 7.58,21 12,21C16.42,21 20,19.21 20,17V14C20,16.21 16.42,18 12,18C7.58,18 4,16.21 4,14Z"/></svg>',

        // Shell Scripts
        'sh': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4CAF50" d="M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M13,13V15H17V13H13M13,9V11H17V9H13M6,10L9,7L11,9L8,12L11,15L9,17L6,14L7,13L6,12L7,11L6,10Z"/></svg>',
        'bash': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4CAF50" d="M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M13,13V15H17V13H13M13,9V11H17V9H13M6,10L9,7L11,9L8,12L11,15L9,17L6,14L7,13L6,12L7,11L6,10Z"/></svg>',
        'zsh': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4CAF50" d="M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M13,13V15H17V13H13M13,9V11H17V9H13M6,10L9,7L11,9L8,12L11,15L9,17L6,14L7,13L6,12L7,11L6,10Z"/></svg>',

        // Mobile Development
        'swift': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#FF4C2F" d="M20.41,13.31A13.75,13.75 0 0,1 8.9,20.94C8.9,20.94 8.9,20.94 8.9,20.94C9.17,21 9.47,21.07 9.79,21.09C10.17,21.13 10.55,21.13 10.93,21.09C13.92,20.85 16.77,19.47 18.93,17.31C17.34,19.85 14.67,21.76 11.61,22.59C10.34,22.96 9.2,23.11 8.26,22.9C7.47,22.73 6.76,22.31 6.24,21.7C5.85,21.23 5.54,20.7 5.41,20.21C5.35,19.89 5.42,19.62 5.5,19.38C5.5,19.38 5.46,19.41 5.39,19.47C5.32,19.5 5.21,19.5 5.14,19.5C4.96,19.47 4.79,19.38 4.64,19.29L4.5,19.23C4.32,19.14 4.21,19.03 4.07,19C3.57,18.7 3.57,17.63 4.07,17.17C4.15,17.09 4.29,17 4.42,16.88C4.5,16.79 4.63,16.68 4.79,16.55C4.93,16.43 5,16.31 5.14,16.27C6.88,15.4 8.74,14.54 10.59,13.71C9.79,14.06 8.96,14.62 8.3,15.34L3.72,19C3.65,19.03 3.62,19.03 3.57,19.07C3.57,19.07 3.57,19.03 3.57,19C3.57,18.93 3.62,18.89 3.65,18.87C6.5,16.84 9.82,15.33 13.38,14.44C14.33,14.17 15.33,13.95 16.33,13.8C16.75,13.74 17.17,13.68 17.62,13.65C18.08,13.62 18.5,13.62 18.93,13.65C19.33,13.68 19.72,13.74 20.11,13.8C20.38,13.83 20.61,13.89 20.8,13.95C20.9,13.98 21,14.06 21.1,14.11C21.2,14.15 21.29,14.2 21.38,14.26C21.38,14.26 21.38,14.29 21.41,14.29C21.96,14.59 22.43,15 22.86,15.46C23.28,15.93 23.64,16.46 23.93,17.03C24.07,17.31 24.18,17.62 24.28,17.92C24.39,18.24 24.46,18.55 24.5,18.87C24.6,19.5 24.53,20.15 24.32,20.77C24.11,21.4 23.71,21.97 23.18,22.46C22.61,22.96 21.93,23.36 21.2,23.58C20.89,23.68 20.59,23.75 20.29,23.79C19.97,23.82 19.67,23.82 19.36,23.79C18.76,23.71 18.19,23.5 17.69,23.17C17.57,23.1 17.45,23 17.34,22.9C17.22,22.8 17.13,22.66 17.03,22.52C16.83,22.21 16.71,21.87 16.68,21.5C16.79,21.6 16.9,21.7 17.03,21.79C17.27,21.97 17.53,22.11 17.81,22.21C18.15,22.35 18.53,22.42 18.88,22.42C19.33,22.42 19.76,22.35 20.17,22.24C20.38,22.17 20.59,22.11 20.77,22C21.34,21.76 21.79,21.33 22,20.77C22.15,20.46 22.21,20.09 22.18,19.76C21.06,18.82 19.6,17.44 18.5,16.61C18.5,16.61 18.5,16.61 18.5,16.62C18.15,16.33 17.75,16.05 17.34,15.82C16.93,15.55 16.5,15.34 16.04,15.16C15.61,15 15.18,14.85 14.73,14.75C14.73,14.75 14.77,14.75 14.77,14.75C16.63,13.82 18.08,13.55 19.43,13.49C19.73,13.46 20.07,13.43 20.41,13.43C20.41,13.37 20.41,13.34 20.41,13.31Z"/></svg>',
        'kotlin': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#7F52FF" d="M2,2H22V22H2V2M4.73,4.73V19.26L12,11.93L19.26,4.73H4.73Z"/></svg>',
        'dart': '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#00B4AB" d="M4.105,4.105C4.105,4.105 12.684,3.43 13.948,4.905C15.211,6.38 9.211,8.567 7.105,10.105C5,11.644 3.948,12.684 2.773,11.567C1.597,10.45 4.105,4.105 4.105,4.105M3.788,14.001C3.788,14.001 4.813,9.105 6.788,11.567C8.764,14.03 16.29,19.689 16.29,19.689C16.29,19.689 18.276,20 17.155,17.368C16.034,14.736 10.459,7.265 9.594,6.344C8.728,5.423 17.264,6.625 17.264,6.625C17.264,6.625 19.629,7 20.837,8.973C22.045,10.947 22.789,15.33 21.13,17.658C19.471,19.987 15.707,22 13.244,22C10.782,22 4.105,22 4.105,22C4.105,22 -1.373,21.44 3.788,14.001Z"/></svg>',

        // Config files
        'gitignore': '⚙️',
        'env': '⚙️',
        'yaml': '⚙️',
        'yml': '⚙️',
        'toml': '⚙️',
        'ini': '⚙️',
        'config': '⚙️',

        // Images
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'gif': '🖼️',
        'svg': '🖼️',
        'ico': '🖼️',
        // Other
        'default': '📄'
    };

    addMessage("how can i help you?", 'model');

    messageInput.addEventListener('input', (e) => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';

        handleAtSymbol(e);
    });

    messageInput.addEventListener('keydown', (e) => {
        if (fileSuggestions.style.display === 'block') {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                handleFileNavigation(e.key === 'ArrowDown' ? 1 : -1);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertSelectedFile();
                return;
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hideFileSuggestions();
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendButton.addEventListener('click', sendMessage);

    setApiKeyButton.addEventListener('click', () => {
        vscode.postMessage({ command: 'setApiKey' });
    });

    vscode.postMessage({ command: 'checkApiKey' });

    window.addEventListener('message', (event) => {
        const message = event.data;

        switch (message.command) {
            case 'apiKeyStatus':
                if (message.exists) {
                    apiKeyContainer.style.display = 'none';
                    chatInterface.style.display = 'flex';
                    chatInterface.style.flexDirection = 'column';
                    chatInterface.style.height = '100%';
                } else {
                    apiKeyContainer.style.display = 'block';
                    chatInterface.style.display = 'none';
                }
                break;

            case 'receiveMessage':
                addMessage(message.message, message.role);
                break;

            case 'startLoading':
                showLoading();
                break;

            case 'stopLoading':
                hideLoading();
                break;

            case 'error':
                showError(message.message);
                hideLoading();
                break;

            case 'clearChat':
                messagesContainer.innerHTML = '';
                break;

            case 'workspaceFiles':
                allFiles = message.files;
                currentFilePage = 1;
                totalFilePages = Math.ceil(allFiles.length / filesPerPage);
                displayFileSuggestions();
                break;

            case 'fileContent':
                console.log('File content received:', message.path);
                break;
        }
    });

    function sendMessage() {
        const text = messageInput.value.trim();
        if (text && !isLoading) {
            addMessage(text, 'user');

            vscode.postMessage({
                command: 'sendMessage',
                text
            });

            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
    }

    function addMessage(text, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;

        const formattedText = formatMessageText(text);
        messageDiv.innerHTML = formattedText;

        messagesContainer.appendChild(messageDiv);

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function formatMessageText(text) {
        if (!text) return '';

        const formattedHTML = marked.parse(text);

        return formattedHTML;
    }

    function showLoading() {
        isLoading = true;

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading';
        loadingDiv.id = 'loading-indicator';
        loadingDiv.innerHTML = `
            Gemini is thinking
            <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function hideLoading() {
        isLoading = false;
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    function showError(errorMessage) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message model-message';
        errorDiv.innerHTML = `<span style="color: var(--vscode-errorForeground);">Error: ${errorMessage}</span>`;
        messagesContainer.appendChild(errorDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function handleAtSymbol(event) {
        const text = messageInput.value;
        const cursorPosition = messageInput.selectionStart;
        const textBeforeCursor = text.substring(0, cursorPosition);

        const match = textBeforeCursor.match(/@([^@\s]*)$/);

        if (match) {
            const query = match[1] || '';

            clearTimeout(fileSearchTimeout);
            fileSearchTimeout = setTimeout(() => {
                vscode.postMessage({
                    command: 'getWorkspaceFiles',
                    query: query
                });
            }, 300);
        } else {
            hideFileSuggestions();
        }
    }

    function getFileIconFromPath(filePath) {
        const extension = filePath.split('.').pop().toLowerCase();
        return fileIcons[extension] || fileIcons['default'];
    }

    function displayFileSuggestions() {
        if (!allFiles || allFiles.length === 0) {
            hideFileSuggestions();
            return;
        }

        fileSuggestions.innerHTML = '';

        const startIndex = (currentFilePage - 1) * filesPerPage;
        const endIndex = Math.min(startIndex + filesPerPage, allFiles.length);
        const currentPageFiles = allFiles.slice(startIndex, endIndex);

        currentPageFiles.forEach((file, index) => {
            const fileElement = document.createElement('div');
            fileElement.className = 'file-suggestion';
            fileElement.dataset.path = file.path;

            const fileIcon = getFileIconFromPath(file.path);

            fileElement.innerHTML = `
                <div class="file-icon">${fileIcon}</div>
                <div class="file-path">${file.path}</div>
            `;

            fileElement.addEventListener('click', () => {
                insertFile(file.path);
            });

            if (index === 0) {
                fileElement.classList.add('selected');
            }

            fileSuggestions.appendChild(fileElement);
        });

        if (allFiles.length > filesPerPage) {
            const paginationDiv = document.createElement('div');
            paginationDiv.className = 'file-pagination';

            paginationDiv.innerHTML = `
                <div class="file-pagination-text">
                    Showing ${startIndex + 1}-${endIndex} of ${allFiles.length}
                </div>
                <div class="file-pagination-buttons">
                    <button class="pagination-button prev-button" ${currentFilePage === 1 ? 'disabled' : ''}>Prev</button>
                    <button class="pagination-button next-button" ${currentFilePage === totalFilePages ? 'disabled' : ''}>Next</button>
                </div>
            `;

            fileSuggestions.appendChild(paginationDiv);

            const prevButton = paginationDiv.querySelector('.prev-button');
            const nextButton = paginationDiv.querySelector('.next-button');

            if (prevButton) {
                prevButton.addEventListener('click', () => {
                    if (currentFilePage > 1) {
                        currentFilePage--;
                        displayFileSuggestions();
                    }
                });
            }

            if (nextButton) {
                nextButton.addEventListener('click', () => {
                    if (currentFilePage < totalFilePages) {
                        currentFilePage++;
                        displayFileSuggestions();
                    }
                });
            }
        }

        fileSuggestions.style.display = 'block';
    }

    function hideFileSuggestions() {
        fileSuggestions.style.display = 'none';
        fileSuggestions.innerHTML = '';
        allFiles = [];
    }

    function handleFileNavigation(direction) {
        const suggestions = fileSuggestions.querySelectorAll('.file-suggestion');
        const currentIndex = Array.from(suggestions).findIndex(el => el.classList.contains('selected'));

        let newIndex = currentIndex + direction;

        if (newIndex < 0) {
            if (currentFilePage > 1) {
                currentFilePage--;
                displayFileSuggestions();
                const newSuggestions = fileSuggestions.querySelectorAll('.file-suggestion');
                newIndex = newSuggestions.length - 1;
                newSuggestions.forEach((el, idx) => {
                    el.classList.toggle('selected', idx === newIndex);
                });
                return;
            } else {
                newIndex = suggestions.length - 1;
            }
        }

        if (newIndex >= suggestions.length) {
            if (currentFilePage < totalFilePages) {
                currentFilePage++;
                displayFileSuggestions();
                const newSuggestions = fileSuggestions.querySelectorAll('.file-suggestion');
                newSuggestions[0].classList.add('selected');
                return;
            } else {
                newIndex = 0;
            }
        }

        suggestions.forEach(el => el.classList.remove('selected'));
        suggestions[newIndex].classList.add('selected');
        suggestions[newIndex].scrollIntoView({ block: 'nearest' });
    }

    function insertSelectedFile() {
        const selected = fileSuggestions.querySelector('.file-suggestion.selected');
        if (selected) {
            insertFile(selected.dataset.path);
        }
    }

    function insertFile(filePath) {
        const text = messageInput.value;
        const cursorPosition = messageInput.selectionStart;
        const textBeforeCursor = text.substring(0, cursorPosition);
        const textAfterCursor = text.substring(cursorPosition);

        const match = textBeforeCursor.match(/@([^@\s]*)$/);
        if (match) {
            const startPos = textBeforeCursor.lastIndexOf('@');
            const newTextBeforeCursor = textBeforeCursor.substring(0, startPos) + '@' + filePath;
            messageInput.value = newTextBeforeCursor + textAfterCursor;
            messageInput.setSelectionRange(newTextBeforeCursor.length, newTextBeforeCursor.length);
            messageInput.focus();
        }

        hideFileSuggestions();
    }
})();