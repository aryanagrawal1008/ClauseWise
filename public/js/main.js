document.addEventListener('DOMContentLoaded', () => {
    // --- Loading Screen Logic ---
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-upload');
    const loadingOverlay = document.getElementById('loading-overlay');

    if (fileInput && uploadForm && loadingOverlay) {
        fileInput.addEventListener('change', () => {
            // Check if a file was actually selected
            if (fileInput.files.length > 0) {
                // Show the loading screen
                loadingOverlay.classList.add('visible');
                // Submit the form after a brief delay to ensure the overlay renders
                setTimeout(() => {
                    uploadForm.submit();
                }, 100);
            }
        });
    }

    // --- Tab Switching Logic ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    if (tabButtons.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const tabId = button.getAttribute('data-tab');
                tabContents.forEach(content => {
                    content.style.display = content.id === tabId ? 'block' : 'none';
                });
            });
        });
    }

    // --- Accordion Logic ---
    const accordionItems = document.querySelectorAll('.accordion-item');
    if (accordionItems.length > 0) {
        accordionItems.forEach(item => {
            const header = item.querySelector('.accordion-header');
            header.addEventListener('click', () => {
                item.classList.toggle('active');
            });
        });
    }
    
    // --- AI Lawyer Chat Logic ---
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const questionInput = document.getElementById('user-question');
            const historyDiv = document.getElementById('chat-history');
            const contractText = document.getElementById('contract-text').value;
            const userQuestion = questionInput.value.trim();
            if (!userQuestion) return;

            appendMessage(historyDiv, userQuestion, 'user');
            questionInput.value = '';

            try {
                const response = await fetch('/ask-lawyer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contractText, userQuestion })
                });
                const data = await response.json();
                const aiResponseHtml = `<strong>Advice:</strong> ${data.advice}<br><strong>Reasoning:</strong> ${data.reasoning}`;
                appendMessage(historyDiv, aiResponseHtml, 'ai');
            } catch (error) {
                appendMessage(historyDiv, 'Sorry, an error occurred.', 'ai');
            }
        });
    }

    function appendMessage(container, html, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        const p = document.createElement('p');
        p.innerHTML = html;
        messageDiv.appendChild(p);
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }
});
