// Database viewer routes for web-based database management
// Since MySQL Workbench may crash, this provides browser-based access

import pool from './db.js';

// Add these routes to your main server.js file
export const dbViewerRoutes = (app) => {
  
  // Get all tables in the database
  app.get('/api/db/tables', async (req, res) => {
    try {
      const [rows] = await pool.query('SHOW TABLES');
      return res.json({
        success: true,
        tables: rows.map(row => Object.values(row)[0])
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get tables',
        error: error.message
      });
    }
  });

  // Get table structure
  app.get('/api/db/table/:tableName/structure', async (req, res) => {
    try {
      const { tableName } = req.params;
      const [rows] = await pool.query(`DESCRIBE ${tableName}`);
      return res.json({
        success: true,
        structure: rows
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get table structure',
        error: error.message
      });
    }
  });

  // Get table data with optional limit
  app.get('/api/db/table/:tableName/data', async (req, res) => {
    try {
      const { tableName } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      const [rows] = await pool.query(`SELECT * FROM ${tableName} LIMIT ?`, [limit]);
      return res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get table data',
        error: error.message
      });
    }
  });

  // Simple database viewer HTML page
  app.get('/db-viewer', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rawson Database Viewer</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #007bff;
            padding-bottom: 10px;
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
        }
        button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
        }
        button:hover {
            background: #0056b3;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #007bff;
            color: white;
        }
        tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        .json-container {
            background: #f8f8f8;
            border: 1px solid #ddd;
            padding: 10px;
            margin-top: 10px;
            border-radius: 4px;
            font-family: monospace;
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏢 Rawson Database Viewer</h1>
        <p>Web-based database management for the Rawson Building Management System</p>
        
        <div class="section">
            <h2>Database Health</h2>
            <button onclick="checkHealth()">Check Database Connection</button>
            <div id="healthStatus"></div>
        </div>

        <div class="section">
            <h2>Tables</h2>
            <button onclick="loadTables()">Load Tables</button>
            <div id="tablesResult"></div>
        </div>

        <div class="section">
            <h2>Table Data</h2>
            <button onclick="loadTableData('tblusers')">View Users Table</button>
            <button onclick="loadTableStructure('tblusers')">View Users Structure</button>
            <div id="tableResult"></div>
        </div>

        <div class="section">
            <h2>Quick Actions</h2>
            <button onclick="testRegister()">Test User Registration</button>
            <button onclick="testLogin()">Test User Login</button>
            <div id="actionResult"></div>
        </div>
    </div>

    <script>
        async function checkHealth() {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                document.getElementById('healthStatus').innerHTML = 
                    '<div class="status success">✅ ' + JSON.stringify(data, null, 2) + '</div>';
            } catch (error) {
                document.getElementById('healthStatus').innerHTML = 
                    '<div class="status error">❌ Error: ' + error.message + '</div>';
            }
        }

        async function loadTables() {
            try {
                const response = await fetch('/api/db/tables');
                const data = await response.json();
                if (data.success) {
                    const tableList = data.tables.map(table => 
                        '<li><strong>' + table + '</strong></li>'
                    ).join('');
                    document.getElementById('tablesResult').innerHTML = 
                        '<div class="status success"><h3>Tables in Database:</h3><ul>' + tableList + '</ul></div>';
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                document.getElementById('tablesResult').innerHTML = 
                    '<div class="status error">❌ Error: ' + error.message + '</div>';
            }
        }

        async function loadTableData(tableName) {
            try {
                const response = await fetch('/api/db/table/' + tableName + '/data');
                const data = await response.json();
                if (data.success && data.data.length > 0) {
                    // Create HTML table
                    const headers = Object.keys(data.data[0]);
                    let tableHtml = '<table><thead><tr>';
                    headers.forEach(header => {
                        tableHtml += '<th>' + header + '</th>';
                    });
                    tableHtml += '</tr></thead><tbody>';
                    
                    data.data.forEach(row => {
                        tableHtml += '<tr>';
                        headers.forEach(header => {
                            let value = row[header];
                            if (header === 'PasswordHash') {
                                value = '[HIDDEN]'; // Don't show password hashes
                            }
                            tableHtml += '<td>' + (value || 'NULL') + '</td>';
                        });
                        tableHtml += '</tr>';
                    });
                    tableHtml += '</tbody></table>';
                    
                    document.getElementById('tableResult').innerHTML = 
                        '<div class="status success"><h3>' + tableName + ' Data (' + data.count + ' records):</h3>' + tableHtml + '</div>';
                } else if (data.success) {
                    document.getElementById('tableResult').innerHTML = 
                        '<div class="status success">✅ Table ' + tableName + ' exists but is empty</div>';
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                document.getElementById('tableResult').innerHTML = 
                    '<div class="status error">❌ Error: ' + error.message + '</div>';
            }
        }

        async function loadTableStructure(tableName) {
            try {
                const response = await fetch('/api/db/table/' + tableName + '/structure');
                const data = await response.json();
                if (data.success) {
                    let tableHtml = '<table><thead><tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th><th>Extra</th></tr></thead><tbody>';
                    data.structure.forEach(field => {
                        tableHtml += '<tr>';
                        tableHtml += '<td><strong>' + field.Field + '</strong></td>';
                        tableHtml += '<td>' + field.Type + '</td>';
                        tableHtml += '<td>' + field.Null + '</td>';
                        tableHtml += '<td>' + field.Key + '</td>';
                        tableHtml += '<td>' + (field.Default || 'NULL') + '</td>';
                        tableHtml += '<td>' + field.Extra + '</td>';
                        tableHtml += '</tr>';
                    });
                    tableHtml += '</tbody></table>';
                    
                    document.getElementById('tableResult').innerHTML = 
                        '<div class="status success"><h3>' + tableName + ' Structure:</h3>' + tableHtml + '</div>';
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                document.getElementById('tableResult').innerHTML = 
                    '<div class="status error">❌ Error: ' + error.message + '</div>';
            }
        }

        async function testRegister() {
            const testUser = {
                fullName: 'Test User ' + Date.now(),
                email: 'test' + Date.now() + '@rawson.local',
                password: 'Password123!',
                phone: '0210000000',
                role: 'Client'
            };

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(testUser)
                });
                const data = await response.json();
                document.getElementById('actionResult').innerHTML = 
                    '<div class="status success"><h3>Registration Test:</h3>' +
                    '<div class="json-container">' + JSON.stringify(data, null, 2) + '</div></div>';
            } catch (error) {
                document.getElementById('actionResult').innerHTML = 
                    '<div class="status error">❌ Registration Error: ' + error.message + '</div>';
            }
        }

        async function testLogin() {
            const loginData = {
                email: 'admin@rawson.local',
                password: 'Password123!'
            };

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(loginData)
                });
                const data = await response.json();
                document.getElementById('actionResult').innerHTML = 
                    '<div class="status success"><h3>Login Test:</h3>' +
                    '<div class="json-container">' + JSON.stringify(data, null, 2) + '</div></div>';
            } catch (error) {
                document.getElementById('actionResult').innerHTML = 
                    '<div class="status error">❌ Login Error: ' + error.message + '</div>';
            }
        }

        // Load health check on page load
        window.onload = function() {
            checkHealth();
        }
    </script>
</body>
</html>
    `);
  });

};
