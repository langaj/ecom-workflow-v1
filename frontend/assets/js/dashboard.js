/* Ecom Workflow System V1 - Dashboard Page */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await api.getDashboard();

    document.getElementById('stat-total').textContent = data.total;
    document.getElementById('stat-running').textContent = data.running;
    document.getElementById('stat-completed').textContent = data.completed;
    document.getElementById('stat-failed').textContent = data.failed;

    const tbody = document.getElementById('recent-tasks');
    if (data.recent && data.recent.length > 0) {
      tbody.innerHTML = data.recent.map(item => `
        <tr onclick="navigate('detail.html?id=${item.id}')">
          <td>${item.batch_no}</td>
          <td>${item.task_name}</td>
          <td>${getStatusBadge(item.status)}</td>
          <td>${formatDateTime(item.created_at)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--gray-400);padding:24px;">暂无任务</td></tr>';
    }
  } catch (err) {
    createToast('加载仪表盘失败: ' + err.message, 'error');
  }
});
