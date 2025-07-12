const menu = document.querySelector('#mobile-menu')
const menuLinks = document.querySelector('.navbar__menu')

menu.addEventListener('click', function() {
    menu.classList.toggle('is-active');
    menuLinks.classList.toggle('active');
});


const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-bZX5wR8VLB1uNQmIVTkq9VImHnh1v4sKFKroFPxkfWsi0QGiCDXUrqT1FgDQOTEJwFWZ8-_Wha8O/pub?gid=1001386983&single=true&output=csv';


fetch(csvUrl)
  .then(response => response.text())
  .then(csvText => {
    // Parse CSV (simple split)
    const rows = csvText.split('\n').map(row => row.split(','));
    
    // Create a table element
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';

    // Loop rows to create table rows
    rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const cellEl = i === 0 ? document.createElement('th') : document.createElement('td');
        cellEl.textContent = cell;
        cellEl.style.border = '1px solid #ccc';
        cellEl.style.padding = '8px';
        tr.appendChild(cellEl);
      });
      table.appendChild(tr);
    });

    document.getElementById('sheet-data').appendChild(table);
  })
  .catch(err => console.error('Error fetching sheet data:', err));

  
