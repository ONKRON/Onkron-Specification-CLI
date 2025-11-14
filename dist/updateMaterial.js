const mysql = require("mysql2");
require('dotenv').config();
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const translations = {
  2: {// Eng
    'Холоднокатаная сталь': 'SPCC cold rolled steel',
    'Нержавеющая сталь': 'Stainless steel',
    'Алюминий': 'Aluminum',
    'Пластик': 'Plastic',
    'Бук': 'Beech',
    'Резина': 'Rubber',
    'Стекло': 'Glass',
  },
  3: { //FR
    'Холоднокатаная сталь': 'Acier laminé à froid',   
    'Нержавеющая сталь': 'Acier inox',
    'Алюминий': 'Aluminium',
    'Пластик': 'Plastique',
    'Бук': 'Hêtre',
    'Резина': 'Caoutchouc',
    'Стекло': 'Verre',
  },
  4: { // IT
    'Холоднокатаная сталь': 'Acciaio freddo',   
    'Нержавеющая сталь': 'Acciaio inossidabile',
    'Алюминий': 'Alluminio',
    'Пластик': 'Plastica',
    'Бук': 'Faggio',
    'Резина': 'Gomma',
    'Стекло': 'Bicchiere',
  },
  5: { // ES
    'Холоднокатаная сталь': 'Acero laminado en frio',   
    'Нержавеющая сталь': 'Acero inoxidable',
    'Алюминий': 'Aluminio',
    'Пластик': 'Plastico',
    'Бук': 'Madera de haya',
    'Резина': 'Goma',
    'Стекло': 'Vaso',
  },

    6: { // Немецкий
      'Холоднокатаная сталь': 'Stahl SPCC',
      'Нержавеющая сталь': 'Rostfreier Stahl',
      'Алюминий': 'Aluminium',
      'Пластик': 'Kunststoff',
      'Бук': 'Holz Buche',
      'Резина': 'Gummi',
      'Стекло': 'Glas',
  },
  7: { //UK
'Холоднокатаная сталь': 'SPCC cold rolled steel',
    'Нержавеющая сталь': 'Stainless steel',
    'Алюминий': 'Aluminum',
    'Пластик': 'Plastic',
    'Бук': 'Beech',
    'Резина': 'Rubber',
    'Стекло': 'Glass',
  },
  8: { //PL
    'Холоднокатаная сталь': 'Stal walcowana na zimno',
        'Нержавеющая сталь': 'Stal nierdzewna',
        'Алюминий': 'Aluminium',
        'Пластик': 'Plastik',
        'Бук': 'Buk',
        'Резина': 'Guma',
        'Стекло': 'Szkło',
      }
}

const countryOptions = {
  2: "US",
  3: "FR",
  4: "IT",
  5: "ES",
  6: "DE",
  7: "UK",
  8: "PL"
};

console.log("Выберите страну для обновления материалов:");
Object.entries(countryOptions).forEach(([id, name]) => {
  console.log(`${id}: ${name}`);
});

rl.question("Введите номер страны (2-8): ", (answer) => {
  const languageId = parseInt(answer.trim());

  if (isNaN(languageId) || !translations[languageId]) {
    console.error("Неверный ввод или нет перевода для выбранной страны.");
    rl.close();
    return;
  }

  const selectedTranslations = translations[languageId];
  
  const connection = mysql.createConnection({
    host: process.env.host,
    user: process.env.user,
    database: process.env.database,
    password: process.env.password,
  });

  connection.connect((err) => {
    if (err) {
      console.error("Ошибка подключения к базе данных:", err);
      rl.close();
      return;
    }

    console.log("Успешное подключение к БД!");

    const sql = `
      SELECT * FROM products_specifications 
      WHERE language_id = 1 AND specifications_id = 61
    `;

    connection.query(sql, (err, results) => {
      if (err) {
        console.error("Ошибка при выполнении запроса:", err);
        rl.close();
        return;
      }

      results.forEach((row) => {
        const originalSpec = row.specification;
        const translatedSpec = selectedTranslations[originalSpec];

        if (!translatedSpec) return; // Пропускаем, если нет перевода

        const upsertSql = `
          INSERT INTO products_specifications 
            (products_id, language_id, specification, specifications_id) 
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            specification = VALUES(specification),
            language_id = VALUES(language_id)
        `;

        connection.execute(
          upsertSql,
          [row.products_id, languageId, translatedSpec, row.specifications_id],
          (err) => {
            if (err) {
              console.error(`Ошибка при обновлении ID ${row.products_id}:`, err);
            } else {
              console.log(`Обновлено: [ID ${row.products_id}] -> ${translatedSpec}`);
            }
          }
        );
      });

      rl.close();
    });
  });
});