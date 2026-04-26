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

const DEFAULT_AUTOFILL_SPEC_IDS = [24, 22, 709, 723, 724, 725, 726, 715, 67];

function parseSpecIdsFromEnv(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return [...fallback];
  }

  const parsed = String(value)
    .split(",")
    .map((token) => Number(token.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (parsed.length === 0) {
    return [...fallback];
  }

  return [...new Set(parsed)];
}

const AUTOFILL_SPEC_IDS = parseSpecIdsFromEnv(
  process.env.SPEC_IDS_AUTOFILL,
  DEFAULT_AUTOFILL_SPEC_IDS
);

const DEFAULT_LOAD_SPEC_IDS = [23, 786, 766, 767, 763];
const LOAD_SPEC_IDS = parseSpecIdsFromEnv(
  process.env.SPEC_IDS_LOAD,
  DEFAULT_LOAD_SPEC_IDS
);

const DEFAULT_HEIGHT_SPEC_IDS = [754, 722, 721, 720, 762, 760, 68];
const HEIGHT_SPEC_IDS = parseSpecIdsFromEnv(
  process.env.SPEC_IDS_HEIGHT,
  DEFAULT_HEIGHT_SPEC_IDS
);

const AUTOFILL_SPEC_LABELS = {
  24: "vesa",
  22: "diagonal-max",
  709: "diagonal-min",
  723: "turn-angle-a",
  724: "turn-angle-b",
  725: "rotation-angle-a",
  726: "rotation-angle-b",
  715: "warranty",
  716: "warranty",
  67: "group-quantity",
};

const LOAD_SPEC_LABELS = {
  23: "max-monitor-tv-weight",
  786: "max-load",
  766: "gross-weight-individual",
  767: "gross-weight-group",
  763: "volume-individual-package",
};

const HEIGHT_SPEC_LABELS = {
  754: "adjustable-height-max",
  722: "adjustable-height-min",
  721: "reach-from-mount-min",
  720: "reach-from-mount-max",
  762: "package-dimensions-individual",
  760: "dimensions-assembled",
  68: "package-dimensions-group",
};

const SPEC_ID_NAMES = {
  22: "Диагональ экрана (max)",
  23: "Макс нагрузка",
  24: "Стандарты VESA",
  60: "Цвет изделия",
  61: "Материал",
  67: "Количество в групповой",
  68: "Габаритные размеры групповой упаковки",
  709: "Диагональ экрана (min)",
  715: "Гарантия",
  720: "Вылет от места крепления (max)",
  721: "Вылет от места крепления (min)",
  722: "Регулируемая высота (max)",
  723: "Угол наклона вверх (max)",
  724: "Угол наклона вниз (max)",
  725: "Угол поворота (диапазон)",
  726: "Угол вращения (диапазон)",
  749: "Обозначение",
  750: "Наименование",
  751: "Артикул",
  752: "Статус",
  753: "Количество экранов",
  754: "Регулируемая высота (min)",
  755: "Сегмент",
  756: "Завод изготовитель",
  757: "Штрих код индивидуальный",
  758: "Штрих код групповой",
  759: "ТНВЭД",
  760: "Габаритные размеры в сборе",
  762: "Габаритные размеры индивидуальной упаковки",
  763: "Объем индивидуальной упаковки",
  764: "Объем групповой упаковки",
  765: "Масса нетто индивидуальна",
  766: "Масса брутто индивидуальная",
  767: "Масса брутто групповая",
  768: "Количество индивидуальных на паллете",
  769: "Количество групповых на паллете",
  770: "Количество индивидуальных в 40ft контейнере",
  771: "Цена ОПТ",
  772: "Цена МИЦ",
  773: "Цена РРЦ",
  774: "Скорость перемещения",
  775: "Класс защищенности",
  776: "Дальность действия пульта ДУ",
  777: "Рабочая температура, диапазон",
  778: "Мощность мотора",
  779: "Гарантия",
  780: "Количество моторов",
  781: "Тип",
  782: "Крепёжные отверстия",
  784: "E-lift",
  785: "Гарантия на электромотор",
  786: "Максимальный вес мониторов/TV",
  787: "Горизонтальное положение экрана",
};

const DEFAULT_TRANSFER_SPEC_IDS = [
  766, 22, 23, 24, 762, 760, 759, 758, 757, 60, 61, 751, 67, 68, 773, 709, 715,
  767, 720, 721, 722, 723, 724, 725, 726, 769, 770, 753, 754, 755, 756, 752, 750,
  749, 763, 765, 772, 771, 764, 768, 779, 774, 775, 776, 777, 778, 780, 781, 782,
  784, 785, 786, 787,
];
const TRANSFER_SPEC_IDS = parseSpecIdsFromEnv(
  process.env.SPEC_IDS_TRANSFER,
  DEFAULT_TRANSFER_SPEC_IDS
);

const TRANSFER_SPEC_LABELS = {
  ...AUTOFILL_SPEC_LABELS,
  ...LOAD_SPEC_LABELS,
  ...HEIGHT_SPEC_LABELS,
  ...SPEC_ID_NAMES,
};

const TRANSFER_GROUP_LABELS = {
  core: "Основное",
  compatibility: "Экран и совместимость",
  motion: "Регулировки и диапазоны",
  materials: "Материал и цвет",
  packaging: "Упаковка и логистика",
  commercial: "Цены и гарантия",
  electric: "Электрика и привод",
  other: "Прочее",
};

const TRANSFER_GROUP_ORDER = [
  "core",
  "compatibility",
  "motion",
  "materials",
  "packaging",
  "commercial",
  "electric",
  "other",
];

const TRANSFER_SPEC_GROUPS = {
  22: "compatibility",
  23: "motion",
  24: "compatibility",
  60: "materials",
  61: "materials",
  67: "packaging",
  68: "packaging",
  709: "compatibility",
  715: "commercial",
  720: "motion",
  721: "motion",
  722: "motion",
  723: "motion",
  724: "motion",
  725: "motion",
  726: "motion",
  749: "core",
  750: "core",
  751: "core",
  752: "core",
  753: "compatibility",
  754: "motion",
  755: "core",
  756: "core",
  757: "packaging",
  758: "packaging",
  759: "core",
  760: "packaging",
  762: "packaging",
  763: "packaging",
  764: "packaging",
  765: "packaging",
  766: "packaging",
  767: "packaging",
  768: "packaging",
  769: "packaging",
  770: "packaging",
  771: "commercial",
  772: "commercial",
  773: "commercial",
  774: "electric",
  775: "electric",
  776: "electric",
  777: "electric",
  778: "electric",
  779: "commercial",
  780: "electric",
  781: "core",
  782: "compatibility",
  784: "core",
  785: "commercial",
  786: "motion",
  787: "compatibility",
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
  height: Number(process.env.SPEC_ID_HEIGHT || 754),
  load: Number(process.env.SPEC_ID_LOAD || 786),
};

module.exports = {
  MATERIAL_TRANSLATIONS,
  COLOR_TRANSLATIONS_EN,
  AUTOFILL_SPEC_IDS,
  AUTOFILL_SPEC_LABELS,
  LOAD_SPEC_IDS,
  LOAD_SPEC_LABELS,
  HEIGHT_SPEC_IDS,
  HEIGHT_SPEC_LABELS,
  SPEC_ID_NAMES,
  TRANSFER_SPEC_IDS,
  TRANSFER_SPEC_LABELS,
  TRANSFER_GROUP_LABELS,
  TRANSFER_GROUP_ORDER,
  TRANSFER_SPEC_GROUPS,
  COUNTRY_BY_LANGUAGE_ID,
  SPEC_IDS,
};
