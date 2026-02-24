const moment = require('moment');

const helpers = {
  formatDate: (date, format = 'YYYY-MM-DD') => {
    return moment(date).format(format);
  },
  
  calculateGrade: (marks, total) => {
    const percentage = (marks / total) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  },
  
  generateReceiptNumber: () => {
    return 'RCP' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
  },
  
  paginate: (array, page, limit) => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      data: array.slice(start, end),
      total: array.length,
      page,
      totalPages: Math.ceil(array.length / limit)
    };
  }
};

module.exports = helpers;