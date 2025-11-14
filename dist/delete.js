const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "shop.onkron.ru",
  user: "shop_o",
  database: "shop_onkron_ru",
  password: "8dYNH846SPvY",
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Успешное подключение к БД!');
   let sql = `DELETE FROM products_specifications WHERE specifications_id = 61 AND language_id = 6`
    connection.query(sql, (err, results) => {
        console.log(results)
        }
      )
    }
)
