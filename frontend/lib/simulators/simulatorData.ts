
/**
 * APEX AI - Catálogo de carros do ACC
 *
 * 54 modelos:
 * GT3: 31 | GT4: 11 | GT2: 6
 * GTC: 5 | TCX: 1
 *
 * modelYear: ano de referência do modelo.
 * addedToAccYear: ano de inclusão no ACC.
 * categoryId: categoria específica.
 * gameClass: classe agrupada do jogo.
 *
 * O filtro principal usa o ano do MODELO,
 * não a temporada oficial do campeonato.
 *
 * Alguns anos históricos são aproximados
 * e poderão ser refinados posteriormente.
 */

export type Simulator = {
  id: string;
  name: string;
};

export type Track = {
  id: string;
  name: string;
};

export type CarCategory = {
  id: string;
  name: string;
  gameClass: string;
};

export type SimulatorCar = {
  id: string;
  name: string;
  categoryId: string;
  gameClass: string;
  modelYear: number;
  addedToAccYear: number;
  accModelId: number;
  dlc?: string;
};

export type SessionSelection = {
  simulatorId: string;
  year: number;
  trackId: string;
  categoryId: string;
  carId: string;
};

export const SIMULATORS: Simulator[] = [
  {
    id: "acc",
    name: "Assetto Corsa Competizione",
  },
];

export const ACC_TRACKS: Track[] = [
  { id: "silverstone", name: "Silverstone" },
  { id: "monza", name: "Monza" },
  { id: "spa", name: "Spa-Francorchamps" },
  { id: "nurburgring", name: "Nürburgring GP" },
  { id: "brands-hatch", name: "Brands Hatch" },
  { id: "barcelona", name: "Barcelona" },
  { id: "zolder", name: "Zolder" },
  { id: "zandvoort", name: "Zandvoort" },
  { id: "misano", name: "Misano" },
  { id: "paul-ricard", name: "Paul Ricard" },
  { id: "hungaroring", name: "Hungaroring" },
  { id: "imola", name: "Imola" },
  { id: "kyalami", name: "Kyalami" },
  { id: "suzuka", name: "Suzuka" },
  { id: "laguna-seca", name: "Laguna Seca" },
  {
    id: "mount-panorama",
    name: "Mount Panorama",
  },
  { id: "donington", name: "Donington Park" },
  { id: "oulton-park", name: "Oulton Park" },
  { id: "snetterton", name: "Snetterton" },
  {
    id: "cota",
    name: "Circuit of the Americas",
  },
  { id: "watkins-glen", name: "Watkins Glen" },
  { id: "indianapolis", name: "Indianapolis" },
  { id: "valencia", name: "Valencia" },
  { id: "red-bull-ring", name: "Red Bull Ring" },
  {
    id: "nordschleife",
    name: "Nürburgring 24h / Nordschleife",
  },
];

export const ACC_CATEGORIES: CarCategory[] = [
  {
    id: "gt3",
    name: "GT3",
    gameClass: "GT3",
  },
  {
    id: "gt4",
    name: "GT4",
    gameClass: "GT4",
  },
  {
    id: "gt2",
    name: "GT2",
    gameClass: "GT2",
  },
  {
    id: "cup",
    name: "Porsche Cup",
    gameClass: "GTC",
  },
  {
    id: "st",
    name: "Super Trofeo",
    gameClass: "GTC",
  },
  {
    id: "chl",
    name: "Ferrari Challenge",
    gameClass: "GTC",
  },
  {
    id: "tcx",
    name: "TCX",
    gameClass: "TCX",
  },
];

/**
 * Cria um carro com categoria consistente.
 */
function car(
  id: string,
  name: string,
  categoryId: string,
  modelYear: number,
  accModelId: number,
  addedToAccYear: number,
  dlc?: string
): SimulatorCar {
  const category = ACC_CATEGORIES.find(
    (item) => item.id === categoryId
  );

  if (!category) {
    throw new Error(
      `Categoria inválida: ${categoryId}`
    );
  }

  return {
    id,
    name,
    categoryId,
    gameClass: category.gameClass,
    modelYear,
    accModelId,
    addedToAccYear,
    ...(dlc ? { dlc } : {}),
  };
}

/**
 * CATÁLOGO COMPLETO - 54 MODELOS
 *
 * O accModelId é o identificador
 * do modelo usado pelo simulador.
 */

export const ACC_CARS: SimulatorCar[] = [
  // ===================================
  // GT3 - 31 CARROS
  // ===================================

  car(
    "jaguar-g3",
    "Emil Frey Jaguar G3",
    "gt3", 2012, 14, 2019
  ),
  car(
    "aston-v12-gt3",
    "Aston Martin V12 Vantage GT3",
    "gt3", 2013, 12, 2019
  ),
  car(
    "audi-r8-lms-2015",
    "Audi R8 LMS GT3 (2015)",
    "gt3", 2015, 3, 2019
  ),
  car(
    "bentley-continental-2015",
    "Bentley Continental GT3 (2015)",
    "gt3", 2015, 11, 2019
  ),
  car(
    "lamborghini-huracan-2015",
    "Lamborghini Huracán GT3 (2015)",
    "gt3", 2015, 4, 2019
  ),
  car(
    "mclaren-650s",
    "McLaren 650S GT3",
    "gt3", 2015, 5, 2019
  ),
  car(
    "mercedes-amg-2015",
    "Mercedes-AMG GT3 (2015)",
    "gt3", 2015, 1, 2019
  ),
  car(
    "nissan-gtr-2015",
    "Nissan GT-R NISMO GT3 (antigo)",
    "gt3", 2015, 10, 2019
  ),
  car(
    "lexus-rcf",
    "Lexus RC F GT3",
    "gt3", 2016, 15, 2019
  ),
  car(
    "bmw-m6",
    "BMW M6 GT3",
    "gt3", 2017, 7, 2019
  ),
  car(
    "honda-nsx-2017",
    "Honda NSX GT3 (2017)",
    "gt3", 2017, 17, 2019
  ),
  car(
    "reiter-rex",
    "Reiter Engineering R-EX GT3",
    "gt3", 2017, 13, 2019
  ),
  car(
    "bentley-continental-2018",
    "Bentley Continental GT3 (2018)",
    "gt3", 2018, 8, 2019
  ),
  car(
    "ferrari-488-2018",
    "Ferrari 488 GT3 (2018)",
    "gt3", 2018, 2, 2019
  ),
  car(
    "nissan-gtr-2018",
    "Nissan GT-R NISMO GT3 (2018)",
    "gt3", 2018, 6, 2019
  ),
  car(
    "porsche-991-2018",
    "Porsche 991 GT3 R (2018)",
    "gt3", 2018, 0, 2019
  ),
  car(
    "aston-v8-2019",
    "Aston Martin V8 Vantage GT3 (2019)",
    "gt3", 2019, 20, 2019
  ),
  car(
    "audi-r8-evo-2019",
    "Audi R8 LMS Evo (2019)",
    "gt3", 2019, 19, 2019
  ),
  car(
    "honda-nsx-evo-2019",
    "Honda NSX GT3 Evo (2019)",
    "gt3", 2019, 21, 2019
  ),
  car(
    "huracan-evo-2019",
    "Lamborghini Huracán GT3 Evo (2019)",
    "gt3", 2019, 16, 2019
  ),
  car(
    "mclaren-720s-2019",
    "McLaren 720S GT3 (2019)",
    "gt3", 2019, 22, 2019
  ),
  car(
    "porsche-991ii-2019",
    "Porsche 991 II GT3 R (2019)",
    "gt3", 2019, 23, 2019
  ),
  car(
    "ferrari-488-evo-2020",
    "Ferrari 488 GT3 Evo (2020)",
    "gt3", 2020, 24, 2020,
    "2020 GT World Challenge Pack"
  ),
  car(
    "mercedes-amg-evo-2020",
    "Mercedes-AMG GT3 Evo (2020)",
    "gt3", 2020, 25, 2020,
    "2020 GT World Challenge Pack"
  ),
  car(
    "bmw-m4-gt3",
    "BMW M4 GT3",
    "gt3", 2021, 30, 2022
  ),
  car(
    "audi-r8-evo2",
    "Audi R8 LMS GT3 Evo II",
    "gt3", 2022, 31, 2022,
    "Challengers Pack"
  ),
  car(
    "ferrari-296",
    "Ferrari 296 GT3",
    "gt3", 2023, 32, 2023,
    "2023 GT World Challenge Pack"
  ),
  car(
    "huracan-evo2",
    "Lamborghini Huracán GT3 EVO2",
    "gt3", 2023, 33, 2023,
    "2023 GT World Challenge Pack"
  ),
  car(
    "porsche-992-gt3r",
    "Porsche 992 GT3 R",
    "gt3", 2023, 34, 2023,
    "2023 GT World Challenge Pack"
  ),
  car(
    "mclaren-720s-evo",
    "McLaren 720S GT3 Evo",
    "gt3", 2023, 35, 2023
  ),
  car(
    "ford-mustang-gt3",
    "Ford Mustang GT3",
    "gt3", 2024, 36, 2024
  ),

  // ===================================
  // GT4 - 11 CARROS
  // ===================================

  car(
    "ginetta-g55",
    "Ginetta G55 GT4",
    "gt4", 2012, 56, 2020,
    "GT4 Pack"
  ),
  car(
    "ktm-xbow-gt4",
    "KTM X-Bow GT4",
    "gt4", 2016, 57, 2020,
    "GT4 Pack"
  ),
  car(
    "maserati-granturismo-gt4",
    "Maserati GranTurismo MC GT4",
    "gt4", 2016, 58, 2020,
    "GT4 Pack"
  ),
  car(
    "mclaren-570s-gt4",
    "McLaren 570S GT4",
    "gt4", 2016, 59, 2020,
    "GT4 Pack"
  ),
  car(
    "mercedes-amg-gt4",
    "Mercedes-AMG GT4",
    "gt4", 2016, 60, 2020,
    "GT4 Pack"
  ),
  car(
    "camaro-gt4",
    "Chevrolet Camaro GT4.R",
    "gt4", 2017, 55, 2020,
    "GT4 Pack"
  ),
  car(
    "alpine-a110",
    "Alpine A110 GT4",
    "gt4", 2018, 50, 2020,
    "GT4 Pack"
  ),
  car(
    "aston-vantage-gt4",
    "Aston Martin Vantage AMR GT4",
    "gt4", 2018, 51, 2020,
    "GT4 Pack"
  ),
  car(
    "audi-r8-gt4",
    "Audi R8 LMS GT4",
    "gt4", 2018, 52, 2020,
    "GT4 Pack"
  ),
  car(
    "bmw-m4-gt4",
    "BMW M4 GT4",
    "gt4", 2018, 53, 2020,
    "GT4 Pack"
  ),
  car(
    "porsche-cayman-gt4",
    "Porsche 718 Cayman GT4 Clubsport",
    "gt4", 2019, 61, 2020,
    "GT4 Pack"
  ),

  // ===================================
  // GT2 - 6 CARROS
  // ===================================

  car(
    "porsche-935",
    "Porsche 935",
    "gt2", 2019, 86, 2024,
    "GT2 Pack"
  ),
  car(
    "audi-r8-gt2",
    "Audi R8 LMS GT2",
    "gt2", 2021, 80, 2024,
    "GT2 Pack"
  ),
  car(
    "ktm-xbow-gt2",
    "KTM X-Bow GT2",
    "gt2", 2021, 82, 2024,
    "GT2 Pack"
  ),
  car(
    "mercedes-amg-gt2",
    "Mercedes-AMG GT2",
    "gt2", 2022, 84, 2024,
    "GT2 Pack"
  ),
  car(
    "porsche-911-gt2-evo",
    "Porsche 911 GT2 RS Clubsport Evo",
    "gt2", 2022, 85, 2024,
    "GT2 Pack"
  ),
  car(
    "maserati-mc20-gt2",
    "Maserati MC20 GT2",
    "gt2", 2023, 83, 2024,
    "GT2 Pack"
  ),

  // ===================================
  // GTC - 5 CARROS
  // ===================================

  // Super Trofeo

  car(
    "huracan-super-trofeo",
    "Lamborghini Huracán Super Trofeo",
    "st", 2015, 18, 2019
  ),
  car(
    "huracan-st-evo2",
    "Lamborghini Huracán Super Trofeo EVO2",
    "st", 2021, 29, 2022,
    "Challengers Pack"
  ),

  // Porsche Cup

  car(
    "porsche-991ii-cup",
    "Porsche 991 II GT3 Cup",
    "cup", 2017, 9, 2019
  ),
  car(
    "porsche-992-cup",
    "Porsche 911 GT3 Cup (992)",
    "cup", 2021, 28, 2022,
    "Challengers Pack"
  ),

  // Ferrari Challenge

  car(
    "ferrari-488-challenge",
    "Ferrari 488 Challenge Evo",
    "chl", 2020, 26, 2022,
    "Challengers Pack"
  ),

  // ===================================
  // TCX - 1 CARRO
  // ===================================

  car(
    "bmw-m2-cs",
    "BMW M2 CS Racing",
    "tcx", 2020, 27, 2022,
    "Challengers Pack"
  ),
];

/**
 * Anos distintos dos modelos
 * existentes no catálogo.
 */
export const ACC_YEARS: number[] = [
  ...new Set(
    ACC_CARS.map((item) => item.modelYear)
  ),
].sort((a, b) => a - b);

/**
 * Todos os carros de um ano EXATO.
 *
 * Exemplo: 2023 retorna apenas
 * os modelos de referência 2023.
 */
export function getCarsByYear(
  year: number
): SimulatorCar[] {
  return ACC_CARS.filter(
    (item) => item.modelYear === year
  ).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );
}

/**
 * Categorias que possuem modelos
 * no ano selecionado.
 */
export function getCategoriesByYear(
  year: number
): CarCategory[] {
  const cars = getCarsByYear(year);

  return ACC_CATEGORIES.filter(
    (category) =>
      cars.some(
        (item) =>
          item.categoryId === category.id
      )
  );
}

/**
 * Carros de uma categoria.
 *
 * Se o ano for informado,
 * filtra pelo ano EXATO do modelo.
 *
 * Sem ano, retorna todos os
 * carros daquela categoria.
 */
export function getCarsByCategory(
  categoryId: string,
  year?: number
): SimulatorCar[] {
  return ACC_CARS.filter(
    (item) =>
      item.categoryId === categoryId &&
      (
        year === undefined ||
        item.modelYear === year
      )
  ).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );
}

/**
 * Carros que já haviam sido
 * adicionados ao ACC até um ano.
 *
 * Filtro diferente do ano do modelo.
 */
export function getCarsAvailableByYear(
  year: number
): SimulatorCar[] {
  return ACC_CARS.filter(
    (item) =>
      item.addedToAccYear <= year
  );
}

/**
 * Busca por ID do Apex AI.
 */
export function getCarById(
  carId: string
): SimulatorCar | undefined {
  return ACC_CARS.find(
    (item) => item.id === carId
  );
}

/**
 * Busca pelo ID nativo do ACC.
 */
export function getCarByAccModelId(
  accModelId: number
): SimulatorCar | undefined {
  return ACC_CARS.find(
    (item) => item.accModelId === accModelId
  );
}

/**
 * Verifica as cinco seleções:
 * jogo, ano, pista, categoria e carro.
 */
export function isValidSessionSelection(
  selection: SessionSelection
): boolean {
  const simulatorValid = SIMULATORS.some(
    (item) =>
      item.id === selection.simulatorId
  );

  const yearValid =
    ACC_YEARS.includes(selection.year);

  const trackValid = ACC_TRACKS.some(
    (item) =>
      item.id === selection.trackId
  );

  const categoryValid = getCategoriesByYear(
    selection.year
  ).some(
    (item) =>
      item.id === selection.categoryId
  );

  const carValid = getCarsByCategory(
    selection.categoryId,
    selection.year
  ).some(
    (item) =>
      item.id === selection.carId
  );

  return (
    simulatorValid &&
    yearValid &&
    trackValid &&
    categoryValid &&
    carValid
  );
}

/**
 * Contagem para conferência.
 */
export const ACC_CAR_COUNTS = {
  total: ACC_CARS.length,
  gt3: ACC_CARS.filter(
    (car) => car.gameClass === "GT3"
  ).length,
  gt4: ACC_CARS.filter(
    (car) => car.gameClass === "GT4"
  ).length,
  gt2: ACC_CARS.filter(
    (car) => car.gameClass === "GT2"
  ).length,
  gtc: ACC_CARS.filter(
    (car) => car.gameClass === "GTC"
  ).length,
  tcx: ACC_CARS.filter(
    (car) => car.gameClass === "TCX"
  ).length,
};
