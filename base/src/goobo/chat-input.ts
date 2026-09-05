export function createChatInput(onSend: (text: string) => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'chat-input-container';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chat-input';
  input.placeholder = 'Type a message...';

  // Listen for the Enter key
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent accidental form submissions or newlines
      
      const text = input.value.trim();
      if (text.length > 0) {
        onSend(text);
        input.value = ''; // Instantly clear the input for the next message
      }
    }
  });

  container.appendChild(input);
  return container;
}
