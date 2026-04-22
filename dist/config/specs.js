const MATERIAL_TRANSLATIONS = {
  2: {
    "Холоднокатаная сталь": "SPCC cold rolled steel",
    "Нержавеющая сталь": "Stainless steel",
    "Алюминий": "Aluminum",
    "Пластик": "Plastic",
    "Бук": "Beech",
    "Резина": "Rubber",
    "Стекло": "Glass",
  },
  3: {
    "Холоднокатаная сталь": "Acier lamine a froid",
    "Нержавеющая сталь": "Acier inox",
    "Алюминий": "Aluminium",
    "Пластик": "Plastique",
    "Бук": "Hetre",
    "Резина": "Caoutchouc",
    "Стекло": "Verre",
  },
  4: {
    "Холоднокатаная сталь": "Acciaio freddo",
    "Нержавеющая сталь": "Acciaio inossidabile",
    "Алюминий": "Alluminio",
    "Пластик": "Plastica",
    "Бук": "Faggio",
    "Резина": "Gomma",
    "Стекло": "Vetro",
  },
  5: {
    "Холоднокатаная сталь": "Acero laminado en frio",
    "Нержавеющая сталь": "Acero inoxidable",
    "Алюминий": "Aluminio",
    "Пластик": "Plastico",
    "Бук": "Madera de haya",
    "Резина": "Goma",
    "Стекло": "Vidrio",
  },
  6: {
    "Холоднокатаная сталь": "Stahl SPCC",
    "Нержавеющая сталь": "Rostfreier Stahl",
    "Алюминий": "Aluminium",
    "Пластик": "Kunststoff",
    "Бук": "Holz Buche",
    "Резина": "Gummi",
    "Стекло": "Glas",
  },
  7: {
    "Холоднокатаная сталь": "SPCC cold rolled steel",
    "Нержавеющая сталь": "Stainless steel",
    "Алюминий": "Aluminum",
    "Пластик": "Plastic",
    "Бук": "Beech",
    "Резина": "Rubber",
    "Стекло": "Glass",
  },
  8: {
    "Холоднокатаная сталь": "Stal walcowana na zimno",
    "Нержавеющая сталь": "Stal nierdzewna",
    "Алюминий": "Aluminium",
    "Пластик": "Plastik",
    "Бук": "Buk",
    "Резина": "Guma",
    "Стекло": "Szklo",
  },
};

const COLOR_TRANSLATIONS_EN = {
  "Белый": "White",
  "Черный": "Black",
  "Серый": "Silver",
  "Серебристый": "Silver",
  "Синий": "Blue",
  "Красный": "Red",
};

const COUNTRY_BY_LANGUAGE_ID = {
  2: "US",
  3: "FR",
  4: "IT",
  5: "ES",
  6: "DE",
  7: "UK",
  8: "PL",
};

const SPEC_IDS = {
  material: Number(process.env.SPEC_ID_MATERIAL || 61),
  color: Number(process.env.SPEC_ID_COLOR || 60),
  height: Number(process.env.SPEC_ID_HEIGHT || 60),
  load: Number(process.env.SPEC_ID_LOAD || 786),
};

module.exports = {
  MATERIAL_TRANSLATIONS,
  COLOR_TRANSLATIONS_EN,
  COUNTRY_BY_LANGUAGE_ID,
  SPEC_IDS,
};
