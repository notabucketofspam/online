export function createGuildModal(onSubmit: (guildName: string) => void): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.className = 'creation-modal';

  dialog.innerHTML = `
    <form method="dialog">
      <h2>Create a New Guild</h2>
      <input type="text" id="guild-name-input" placeholder="Guild Name" required autocomplete="off" />
      <div class="modal-actions">
        <button type="button" id="cancel-btn">Cancel</button>
        <button type="submit" id="submit-btn">Create</button>
      </div>
    </form>
  `;

  // 1. Handle Submission
  dialog.addEventListener('submit', () => {
    const input = dialog.querySelector('#guild-name-input') as HTMLInputElement;
    onSubmit(input.value);
    dialog.close(); 
  });

  // 2. Handle Cancelation
  dialog.querySelector('#cancel-btn')?.addEventListener('click', () => {
    dialog.close();
  });

  // 3. The Destructor: Wipe the node from the DOM when closed
  dialog.addEventListener('close', () => {
    dialog.remove();
  });

  return dialog;
}
