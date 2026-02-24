// Main JavaScript file for School Management System

document.addEventListener('DOMContentLoaded', function() {
    // Auto-hide alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert-auto-hide');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    });

    // Confirm delete actions
    document.querySelectorAll('.confirm-delete').forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (!confirm('Are you sure you want to delete this item?')) {
                e.preventDefault();
            }
        });
    });

    // Dynamic form fields
    window.addFormField = function(containerId, template) {
        const container = document.getElementById(containerId);
        const div = document.createElement('div');
        div.innerHTML = template;
        container.appendChild(div);
    };

    // Print functionality
    window.printPage = function() {
        window.print();
    };

    // Update unread notification count
    async function updateNotificationCount() {
        try {
            const response = await fetch('/notifications/unread-count');
            const data = await response.json();
            if (data.success) {
                const badge = document.getElementById('notifCount');
                if (badge) {
                    badge.textContent = data.count;
                    badge.style.display = data.count > 0 ? 'block' : 'none';
                }
            }
        } catch (error) {
            console.error('Failed to update notification count:', error);
        }
    }

    // Update notifications every 30 seconds
    if (document.getElementById('notifCount')) {
        updateNotificationCount();
        setInterval(updateNotificationCount, 30000);
    }
});