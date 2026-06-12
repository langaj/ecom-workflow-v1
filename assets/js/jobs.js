/* Ecom Workflow System V1 - Jobs List Page */

let currentPage = 1;
const pageSize = 20;

document.addEventListener('DOMContentLoaded', () => {
  loadBatches();

  document.getElementById('search-input').addEventListener('input', (e) => {
    currentPage = 1;
    loadBatches();
  });

  document.getElementById('status-filter').addEventListener('change', () => {
    currentPage = 1;
    loadBatches();
  });
});

async function loadBatches() {
  const tbody = document.getElementById('batch-table-body');
  const pagination = document.getElementById('pagination');

  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;"><div class="spinner" style="margin:0 auto;"></div></td></tr>';

  try {
    const search = document.getElementById('search-input').value;
    const status = document.getElementById('status-filter').value;

    const params = { page: currentPage, pageSize };
    if (search) params.search = search;
    if (status) params.status = status;

    const result = await api.listBatches(params);

    if (result.data && result.data.length > 0) {
      tbody.innerHTML = result.data.map(item => `
        <tr onclick="navigate('detail.html?id=${item.id}')">
          <td><strong>${item.batch_no}</strong></td>
          <td>${item.task_name}</td>
          <td>${getStatusBadge(item.status)}</td>
          <td>${formatDateTime(item.created_at)}</td>
          <td>${formatDateTime(item.updated_at)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--gray-400);">No tasks found</td></tr>';
    }

    // Pagination
    const totalPages = Math.ceil(result.total / pageSize);
    if (totalPages > 1) {
      let pagesHtml = `<button class="btn btn-secondary btn-sm" onclick="goPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>Prev</button>`;
      for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        pagesHtml += `<button class="btn ${i === currentPage ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="goPage(${i})">${i}</button>`;
      }
      pagesHtml += `<button class="btn btn-secondary btn-sm" onclick="goPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>`;
      pagesHtml += `<span class="pagination-info">Total ${result.total} </span>`;
      pagination.innerHTML = pagesHtml;
    } else {
      pagination.innerHTML = '';
    }

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--red-600);">Load failed: ${err.message}</td></tr>`;
  }
}

function goPage(page) {
  currentPage = page;
  loadBatches();
}
