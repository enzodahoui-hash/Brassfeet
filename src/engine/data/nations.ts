// Nacionalidades e bancos de nomes para geração de jogadores (combinações fictícias).

export interface Nation {
  code: string;
  name: string;
  flag: [string, string, string];
}

export const NATIONS: Record<string, Nation> = {
  BRA: { code: 'BRA', name: 'Brasil', flag: ['#1a9b3c', '#ffd400', '#1d3f9a'] },
  ARG: { code: 'ARG', name: 'Argentina', flag: ['#74acdf', '#ffffff', '#74acdf'] },
  URU: { code: 'URU', name: 'Uruguai', flag: ['#ffffff', '#0038a8', '#fcd116'] },
  CHI: { code: 'CHI', name: 'Chile', flag: ['#0039a6', '#ffffff', '#d52b1e'] },
  COL: { code: 'COL', name: 'Colômbia', flag: ['#fcd116', '#003893', '#ce1126'] },
  ECU: { code: 'ECU', name: 'Equador', flag: ['#ffdd00', '#034ea2', '#ed1c24'] },
  PAR: { code: 'PAR', name: 'Paraguai', flag: ['#d52b1e', '#ffffff', '#0038a8'] },
  PER: { code: 'PER', name: 'Peru', flag: ['#d91023', '#ffffff', '#d91023'] },
  BOL: { code: 'BOL', name: 'Bolívia', flag: ['#d52b1e', '#f9e300', '#007934'] },
  VEN: { code: 'VEN', name: 'Venezuela', flag: ['#ffcc00', '#00247d', '#cf142b'] },
  ENG: { code: 'ENG', name: 'Inglaterra', flag: ['#ffffff', '#ce1124', '#ffffff'] },
  ESP: { code: 'ESP', name: 'Espanha', flag: ['#aa151b', '#f1bf00', '#aa151b'] },
  ITA: { code: 'ITA', name: 'Itália', flag: ['#009246', '#ffffff', '#ce2b37'] },
  GER: { code: 'GER', name: 'Alemanha', flag: ['#000000', '#dd0000', '#ffce00'] },
  FRA: { code: 'FRA', name: 'França', flag: ['#0055a4', '#ffffff', '#ef4135'] },
  POR: { code: 'POR', name: 'Portugal', flag: ['#046a38', '#da291c', '#da291c'] },
  NED: { code: 'NED', name: 'Holanda', flag: ['#ae1c28', '#ffffff', '#21468b'] },
  BEL: { code: 'BEL', name: 'Bélgica', flag: ['#000000', '#fdda24', '#ef3340'] },
  CRO: { code: 'CRO', name: 'Croácia', flag: ['#ff0000', '#ffffff', '#171796'] },
  NOR: { code: 'NOR', name: 'Noruega', flag: ['#ba0c2f', '#ffffff', '#00205b'] },
  SWE: { code: 'SWE', name: 'Suécia', flag: ['#006aa7', '#fecc00', '#006aa7'] },
  DEN: { code: 'DEN', name: 'Dinamarca', flag: ['#c8102e', '#ffffff', '#c8102e'] },
  POL: { code: 'POL', name: 'Polônia', flag: ['#ffffff', '#dc143c', '#dc143c'] },
  SUI: { code: 'SUI', name: 'Suíça', flag: ['#ff0000', '#ffffff', '#ff0000'] },
  AUT: { code: 'AUT', name: 'Áustria', flag: ['#ed2939', '#ffffff', '#ed2939'] },
  SCO: { code: 'SCO', name: 'Escócia', flag: ['#005eb8', '#ffffff', '#005eb8'] },
  SRB: { code: 'SRB', name: 'Sérvia', flag: ['#c6363c', '#0c4076', '#ffffff'] },
  SVN: { code: 'SVN', name: 'Eslovênia', flag: ['#ffffff', '#005da4', '#ed1c24'] },
  SVK: { code: 'SVK', name: 'Eslováquia', flag: ['#ffffff', '#0b4ea2', '#ee1c25'] },
  HUN: { code: 'HUN', name: 'Hungria', flag: ['#ce2939', '#ffffff', '#477050'] },
  GEO: { code: 'GEO', name: 'Geórgia', flag: ['#ffffff', '#ff0000', '#ffffff'] },
  TUR: { code: 'TUR', name: 'Turquia', flag: ['#e30a17', '#ffffff', '#e30a17'] },
  UKR: { code: 'UKR', name: 'Ucrânia', flag: ['#0057b7', '#ffd700', '#0057b7'] },
  USA: { code: 'USA', name: 'Estados Unidos', flag: ['#b22234', '#ffffff', '#3c3b6e'] },
  CAN: { code: 'CAN', name: 'Canadá', flag: ['#ff0000', '#ffffff', '#ff0000'] },
  MEX: { code: 'MEX', name: 'México', flag: ['#006847', '#ffffff', '#ce1126'] },
  NGA: { code: 'NGA', name: 'Nigéria', flag: ['#008751', '#ffffff', '#008751'] },
  SEN: { code: 'SEN', name: 'Senegal', flag: ['#00853f', '#fdef42', '#e31b23'] },
  CIV: { code: 'CIV', name: 'Costa do Marfim', flag: ['#f77f00', '#ffffff', '#009e60'] },
  CMR: { code: 'CMR', name: 'Camarões', flag: ['#007a5e', '#ce1126', '#fcd116'] },
  GHA: { code: 'GHA', name: 'Gana', flag: ['#ce1126', '#fcd116', '#006b3f'] },
  MAR: { code: 'MAR', name: 'Marrocos', flag: ['#c1272d', '#006233', '#c1272d'] },
  ALG: { code: 'ALG', name: 'Argélia', flag: ['#006233', '#ffffff', '#d21034'] },
  EGY: { code: 'EGY', name: 'Egito', flag: ['#ce1126', '#ffffff', '#000000'] },
  GUI: { code: 'GUI', name: 'Guiné', flag: ['#ce1126', '#fcd116', '#009460'] },
  MLI: { code: 'MLI', name: 'Mali', flag: ['#14b53a', '#fcd116', '#ce1126'] },
  JPN: { code: 'JPN', name: 'Japão', flag: ['#ffffff', '#bc002d', '#ffffff'] },
  KOR: { code: 'KOR', name: 'Coreia do Sul', flag: ['#ffffff', '#cd2e3a', '#0047a0'] },
  CZE: { code: 'CZE', name: 'Tchéquia', flag: ['#ffffff', '#d7141a', '#11457e'] },
  ISL: { code: 'ISL', name: 'Islândia', flag: ['#02529c', '#ffffff', '#dc1e35'] },
  IRL: { code: 'IRL', name: 'Irlanda', flag: ['#169b62', '#ffffff', '#ff883e'] },
  WAL: { code: 'WAL', name: 'País de Gales', flag: ['#ffffff', '#00b140', '#d30731'] },
  COD: { code: 'COD', name: 'RD Congo', flag: ['#007fff', '#f7d618', '#ce1021'] },
  PAN: { code: 'PAN', name: 'Panamá', flag: ['#ffffff', '#d21034', '#005293'] },
  NIR: { code: 'NIR', name: 'Irlanda do Norte', flag: ['#ffffff', '#d10000', '#ffffff'] },
  FIN: { code: 'FIN', name: 'Finlândia', flag: ['#ffffff', '#002f6c', '#ffffff'] },
  AUS: { code: 'AUS', name: 'Austrália', flag: ['#00008b', '#ffffff', '#ff0000'] },
  GRE: { code: 'GRE', name: 'Grécia', flag: ['#0d5eaf', '#ffffff', '#0d5eaf'] },
  BIH: { code: 'BIH', name: 'Bósnia e Herzegovina', flag: ['#002395', '#fecb00', '#ffffff'] },
  ALB: { code: 'ALB', name: 'Albânia', flag: ['#e41e20', '#000000', '#e41e20'] },
  KOS: { code: 'KOS', name: 'Kosovo', flag: ['#244aa5', '#d0a650', '#ffffff'] },
  BFA: { code: 'BFA', name: 'Burkina Faso', flag: ['#ef2b2d', '#fcd116', '#009e49'] },
  JAM: { code: 'JAM', name: 'Jamaica', flag: ['#009b3a', '#fed100', '#000000'] },
  BUL: { code: 'BUL', name: 'Bulgária', flag: ['#ffffff', '#00966e', '#d62612'] },
  COM: { code: 'COM', name: 'Comores', flag: ['#ffc61e', '#3a75c4', '#3d8e33'] },
  TUN: { code: 'TUN', name: 'Tunísia', flag: ['#e70013', '#ffffff', '#e70013'] },
  ROU: { code: 'ROU', name: 'Romênia', flag: ['#002b7f', '#fcd116', '#ce1126'] },
  MTQ: { code: 'MTQ', name: 'Martinica', flag: ['#00a650', '#000000', '#e1121a'] },
  GAB: { code: 'GAB', name: 'Gabão', flag: ['#009e60', '#fcd116', '#3a75c4'] },
  CPV: { code: 'CPV', name: 'Cabo Verde', flag: ['#003893', '#ffffff', '#cf2027'] },
  GAM: { code: 'GAM', name: 'Gâmbia', flag: ['#ce1126', '#0c1c8c', '#3a7728'] },
  SYR: { code: 'SYR', name: 'Síria', flag: ['#ce1126', '#ffffff', '#000000'] },
  DOM: { code: 'DOM', name: 'República Dominicana', flag: ['#002d62', '#ffffff', '#ce1126'] },
  NZL: { code: 'NZL', name: 'Nova Zelândia', flag: ['#00247d', '#ffffff', '#cc142b'] },
  MNE: { code: 'MNE', name: 'Montenegro', flag: ['#c40308', '#d4af3a', '#c40308'] },
  LUX: { code: 'LUX', name: 'Luxemburgo', flag: ['#ed2939', '#ffffff', '#00a1de'] },
  GNB: { code: 'GNB', name: 'Guiné-Bissau', flag: ['#ce1126', '#fcd116', '#009e49'] },
  HAI: { code: 'HAI', name: 'Haiti', flag: ['#00209f', '#d21034', '#ffffff'] },
  ISR: { code: 'ISR', name: 'Israel', flag: ['#ffffff', '#0038b8', '#ffffff'] },
  GLP: { code: 'GLP', name: 'Guadalupe', flag: ['#1b4a9a', '#ffffff', '#e1121a'] },
  TOG: { code: 'TOG', name: 'Togo', flag: ['#006a4e', '#ffce00', '#d21034'] },
  ANG: { code: 'ANG', name: 'Angola', flag: ['#cc092f', '#000000', '#ffcb00'] },
  ARM: { code: 'ARM', name: 'Armênia', flag: ['#d90012', '#0033a0', '#f2a800'] },
  PLE: { code: 'PLE', name: 'Palestina', flag: ['#000000', '#ffffff', '#149954'] },
  SUR: { code: 'SUR', name: 'Suriname', flag: ['#377e3f', '#ffffff', '#b40a2d'] },
  CTA: { code: 'CTA', name: 'República Centro-Africana', flag: ['#003082', '#ffffff', '#289728'] },
  ZIM: { code: 'ZIM', name: 'Zimbábue', flag: ['#319208', '#ffd200', '#de2010'] },
  EST: { code: 'EST', name: 'Estônia', flag: ['#0072ce', '#000000', '#ffffff'] },
  KEN: { code: 'KEN', name: 'Quênia', flag: ['#000000', '#bb0000', '#006600'] },
  IDN: { code: 'IDN', name: 'Indonésia', flag: ['#ce1126', '#ffffff', '#ce1126'] },
  RUS: { code: 'RUS', name: 'Rússia', flag: ['#ffffff', '#0039a6', '#d52b1e'] },
  EQG: { code: 'EQG', name: 'Guiné Equatorial', flag: ['#3e9a00', '#ffffff', '#e32118'] },
  MTN: { code: 'MTN', name: 'Mauritânia', flag: ['#006233', '#ffc400', '#d01c1f'] },
  CUW: { code: 'CUW', name: 'Curaçao', flag: ['#002b7f', '#f9e814', '#ffffff'] },
  LTU: { code: 'LTU', name: 'Lituânia', flag: ['#fdb913', '#006a44', '#c1272d'] },
  CGO: { code: 'CGO', name: 'Congo', flag: ['#009543', '#fbde4a', '#dc241f'] },
  MAD: { code: 'MAD', name: 'Madagascar', flag: ['#ffffff', '#fc3d32', '#007e3a'] },
  CRC: { code: 'CRC', name: 'Costa Rica', flag: ['#002b7f', '#ffffff', '#ce1126'] },
  CYP: { code: 'CYP', name: 'Chipre', flag: ['#ffffff', '#d57800', '#4e5b31'] },
  BEN: { code: 'BEN', name: 'Benin', flag: ['#008751', '#fcd116', '#e8112d'] },
  SLE: { code: 'SLE', name: 'Serra Leoa', flag: ['#1eb53a', '#ffffff', '#0072c6'] },
  PHI: { code: 'PHI', name: 'Filipinas', flag: ['#0038a8', '#ffffff', '#ce1126'] },
  MKD: { code: 'MKD', name: 'Macedônia do Norte', flag: ['#d20000', '#ffe600', '#d20000'] },
  AND: { code: 'AND', name: 'Andorra', flag: ['#10069f', '#fedd00', '#d50032'] },
  ZAM: { code: 'ZAM', name: 'Zâmbia', flag: ['#198a00', '#ef7d00', '#de2010'] },
  GUA: { code: 'GUA', name: 'Guatemala', flag: ['#4997d0', '#ffffff', '#4997d0'] },
  RSA: { code: 'RSA', name: 'África do Sul', flag: ['#007a4d', '#ffb612', '#de3831'] },
  JOR: { code: 'JOR', name: 'Jordânia', flag: ['#000000', '#ffffff', '#007a3d'] },
  LCA: { code: 'LCA', name: 'Santa Lúcia', flag: ['#65cfff', '#ffce00', '#000000'] },
  LVA: { code: 'LVA', name: 'Letônia', flag: ['#9e3039', '#ffffff', '#9e3039'] },
  TRI: { code: 'TRI', name: 'Trinidad e Tobago', flag: ['#ce1126', '#000000', '#ffffff'] },
  NIG: { code: 'NIG', name: 'Níger', flag: ['#e05206', '#ffffff', '#0db02b'] },
  CHA: { code: 'CHA', name: 'Chade', flag: ['#002664', '#fecb00', '#c60c30'] },
  MLT: { code: 'MLT', name: 'Malta', flag: ['#ffffff', '#cf142b', '#ffffff'] },
  NGR: { code: 'NGR', name: 'Nigéria', flag: ['#008751', '#ffffff', '#008751'] },
  THA: { code: 'THA', name: 'Tailândia', flag: ['#a51931', '#f4f5f8', '#2d2a4a'] },
  PUR: { code: 'PUR', name: 'Porto Rico', flag: ['#ed0000', '#ffffff', '#0050f0'] },
  HON: { code: 'HON', name: 'Honduras', flag: ['#0073cf', '#ffffff', '#0073cf'] },
  SLV: { code: 'SLV', name: 'El Salvador', flag: ['#0047ab', '#ffffff', '#0047ab'] },
  NIC: { code: 'NIC', name: 'Nicarágua', flag: ['#0067c6', '#ffffff', '#0067c6'] },
  UZB: { code: 'UZB', name: 'Uzbequistão', flag: ['#0099b5', '#ffffff', '#1eb53a'] },
  MOZ: { code: 'MOZ', name: 'Moçambique', flag: ['#009739', '#000000', '#fce100'] },
  KAZ: { code: 'KAZ', name: 'Cazaquistão', flag: ['#00afca', '#fec50c', '#00afca'] },
  AFG: { code: 'AFG', name: 'Afeganistão', flag: ['#000000', '#d32011', '#007a36'] },
  SGP: { code: 'SGP', name: 'Singapura', flag: ['#ef3340', '#ffffff', '#ef3340'] },
  BRB: { code: 'BRB', name: 'Barbados', flag: ['#00267f', '#ffc726', '#000000'] },
  BAN: { code: 'BAN', name: 'Bangladesh', flag: ['#006a4e', '#f42a41', '#006a4e'] },
  NAM: { code: 'NAM', name: 'Namíbia', flag: ['#003580', '#d21034', '#009543'] },
  SKN: { code: 'SKN', name: 'São Cristóvão e Névis', flag: ['#009e49', '#000000', '#ce1126'] },
  QAT: { code: 'QAT', name: 'Catar', flag: ['#8a1538', '#ffffff', '#8a1538'] },
  FRO: { code: 'FRO', name: 'Ilhas Faroé', flag: ['#ffffff', '#005eb8', '#ef3340'] },
  AZE: { code: 'AZE', name: 'Azerbaijão', flag: ['#0092bc', '#e4002b', '#00af66'] },
  LBN: { code: 'LBN', name: 'Líbano', flag: ['#ed1c24', '#ffffff', '#00a651'] },
  MWI: { code: 'MWI', name: 'Malawi', flag: ['#000000', '#ce1126', '#339e35'] },
  UGA: { code: 'UGA', name: 'Uganda', flag: ['#000000', '#fcdc04', '#d90000'] },
  ERI: { code: 'ERI', name: 'Eritreia', flag: ['#12ad2b', '#ea0437', '#4189dd'] },
  KSA: { code: 'KSA', name: 'Arábia Saudita', flag: ['#006c35', '#ffffff', '#006c35'] },
  BDI: { code: 'BDI', name: 'Burundi', flag: ['#ce1126', '#ffffff', '#1eb53a'] },
  CHN: { code: 'CHN', name: 'China', flag: ['#de2910', '#ffde00', '#de2910'] },
  TAN: { code: 'TAN', name: 'Tanzânia', flag: ['#1eb53a', '#fcd116', '#00a3dd'] },
  GUF: { code: 'GUF', name: 'Guiana Francesa', flag: ['#0b8b3c', '#fde42d', '#e30613'] },
};

export function nationName(code: string): string {
  return NATIONS[code]?.name ?? code;
}

interface NamePool {
  first: string[];
  last: string[];
  nick?: number; // probabilidade de usar só primeiro nome/apelido
}

const PT_FIRST = ['Gabriel', 'Lucas', 'Matheus', 'Pedro', 'Rafael', 'Guilherme', 'Felipe', 'Bruno', 'Thiago', 'Vinícius', 'Gustavo', 'João', 'Caio', 'Diego', 'Rodrigo', 'Leonardo', 'André', 'Eduardo', 'Marcos', 'Igor', 'Kauã', 'Davi', 'Arthur', 'Heitor', 'Luan', 'Wesley', 'Wellington', 'Everton', 'Douglas', 'Renan', 'Alisson', 'Marlon', 'Jean', 'Fabrício', 'Ramon', 'Murilo', 'Henrique', 'Samuel', 'Emerson', 'Danilo', 'Patrick', 'Yago', 'Ruan', 'Kaique', 'Cauã', 'Breno', 'Otávio', 'Vitor', 'Ícaro', 'Nathan'];
const PT_LAST = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Gonçalves', 'Santana', 'Teixeira', 'Araújo', 'Pinto', 'Correia', 'Moura', 'Cunha', 'Campos', 'Batista', 'Brandão', 'Siqueira', 'Bezerra', 'Farias', 'Queiroz', 'Monteiro', 'Peixoto', 'Leite'];
const ES_FIRST = ['Juan', 'Santiago', 'Matías', 'Nicolás', 'Facundo', 'Lautaro', 'Agustín', 'Tomás', 'Franco', 'Gonzalo', 'Joaquín', 'Ezequiel', 'Maximiliano', 'Rodrigo', 'Federico', 'Lucas', 'Mateo', 'Diego', 'Martín', 'Bruno', 'Sebastián', 'Ignacio', 'Emiliano', 'Thiago', 'Valentín', 'Cristian', 'Brian', 'Alan', 'Kevin', 'Leandro', 'Pablo', 'Esteban', 'Ramiro', 'Marcelo', 'Andrés'];
const ES_LAST = ['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez', 'Romero', 'Sánchez', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Benítez', 'Medina', 'Herrera', 'Suárez', 'Aguirre', 'Giménez', 'Molina', 'Castro', 'Ortiz', 'Silva', 'Núñez', 'Rojas', 'Vera', 'Cabrera', 'Ríos', 'Sosa', 'Godoy', 'Villalba', 'Paredes', 'Ledesma', 'Quintero', 'Morales', 'Vargas', 'Mendoza'];
const COL_LAST = ['Rodríguez', 'Gómez', 'Valencia', 'Cuadrado', 'Mosquera', 'Murillo', 'Arias', 'Zapata', 'Córdoba', 'Rentería', 'Palacios', 'Hinestroza', 'Borja', 'Castaño', 'Quintero', 'Carabalí', 'Mina', 'Sinisterra', 'Lerma', 'Uribe', 'Vásquez', 'Ospina', 'Moreno', 'Asprilla', 'Cuesta'];
const ECU_LAST = ['Valencia', 'Caicedo', 'Plata', 'Estupiñán', 'Hincapié', 'Preciado', 'Arboleda', 'Méndez', 'Sornoza', 'Angulo', 'Cortez', 'Corozo', 'Quiñónez', 'Castillo', 'Ordóñez', 'Pacho', 'Gruezo', 'Ibarra', 'Mena', 'Porozo'];
const EN_FIRST = ['Harry', 'Jack', 'James', 'Oliver', 'George', 'Charlie', 'Thomas', 'Joe', 'Callum', 'Jordan', 'Mason', 'Ben', 'Luke', 'Ryan', 'Lewis', 'Kieran', 'Conor', 'Aaron', 'Tyrone', 'Marcus', 'Reece', 'Liam', 'Ethan', 'Archie', 'Alfie', 'Danny', 'Jamie', 'Sam', 'Tom', 'Josh', 'Adam', 'Nathan', 'Kyle', 'Dominic', 'Ollie'];
const EN_LAST = ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Robinson', 'Wright', 'Thompson', 'Evans', 'Walker', 'White', 'Roberts', 'Green', 'Hall', 'Wood', 'Jackson', 'Clarke', 'Hughes', 'Edwards', 'Turner', 'Hill', 'Moore', 'Cooper', 'Ward', 'Morris', 'King', 'Baker', 'Harris', 'Lewis', 'Mitchell', 'Barnes', 'Fletcher', 'Henderson', 'Chapman', 'Gibbs', 'Shaw', 'Stones'];
const ESP_FIRST = ['Álvaro', 'Pablo', 'Sergio', 'Javier', 'Daniel', 'Adrián', 'David', 'Carlos', 'Mario', 'Hugo', 'Marcos', 'Iker', 'Unai', 'Aitor', 'Raúl', 'Jorge', 'Rubén', 'Óscar', 'Víctor', 'Alejandro', 'Íñigo', 'Mikel', 'Jon', 'Borja', 'Fran', 'Dani', 'Nacho', 'Gonzalo', 'Alberto', 'Rafa'];
const ESP_LAST = ['García', 'Martín', 'Sánchez', 'Pérez', 'Gómez', 'Navarro', 'Ruiz', 'Hernández', 'Jiménez', 'Moreno', 'Muñoz', 'Romero', 'Alonso', 'Gutiérrez', 'Serrano', 'Blanco', 'Molina', 'Morales', 'Ortega', 'Delgado', 'Castro', 'Rubio', 'Marín', 'Iglesias', 'Medina', 'Garrido', 'Cortés', 'Santos', 'Lozano', 'Cano', 'Prieto', 'Méndez', 'Vidal', 'Fuentes', 'Carrasco', 'Aguirre', 'Etxeberria', 'Zubeldia', 'Arrieta', 'Olabe'];
const IT_FIRST = ['Lorenzo', 'Alessandro', 'Matteo', 'Francesco', 'Andrea', 'Federico', 'Marco', 'Luca', 'Davide', 'Riccardo', 'Gianluca', 'Stefano', 'Simone', 'Nicolò', 'Giacomo', 'Daniele', 'Emanuele', 'Filippo', 'Tommaso', 'Gabriele', 'Pietro', 'Mattia', 'Fabio', 'Antonio', 'Giorgio', 'Samuele', 'Michele', 'Salvatore', 'Edoardo', 'Manuel'];
const IT_LAST = ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani', 'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone', 'Longo', 'Gentile', 'Vitale', 'Serra', 'Coppola', 'De Santis', 'Pellegrini', 'Bellini', 'Ruggiero', 'Orsolini'];
const DE_FIRST = ['Leon', 'Lukas', 'Jonas', 'Finn', 'Tim', 'Niklas', 'Jan', 'Felix', 'Maximilian', 'Paul', 'Julian', 'Moritz', 'Florian', 'Kevin', 'Marco', 'Philipp', 'Tobias', 'Sebastian', 'Dennis', 'Robin', 'Nico', 'Kai', 'Lars', 'Malte', 'Yannick', 'Jannik', 'Benedikt', 'Fabian', 'Luca', 'Ole'];
const DE_LAST = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Braun', 'Zimmermann', 'Krüger', 'Hartmann', 'Lange', 'Werner', 'Krause', 'Lehmann', 'Köhler', 'Maier', 'Huber', 'Kaiser', 'Fuchs', 'Peters', 'Scholz', 'Möller', 'Weiß', 'Jung', 'Hahn', 'Vogel', 'Friedrich', 'Keller', 'Günther'];
const FR_FIRST = ['Lucas', 'Hugo', 'Théo', 'Nathan', 'Louis', 'Mathis', 'Enzo', 'Clément', 'Maxime', 'Antoine', 'Kylian', 'Rayan', 'Yanis', 'Mehdi', 'Bilal', 'Moussa', 'Ibrahima', 'Ousmane', 'Adrien', 'Benjamin', 'Romain', 'Quentin', 'Jordan', 'Kévin', 'Florian', 'Alexis', 'Warren', 'Malo', 'Tanguy', 'Désiré'];
const FR_LAST = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'Mercier', 'Bonnet', 'Lambert', 'Fontaine', 'Rousseau', 'Diallo', 'Traoré', 'Camara', 'Koné', 'Konaté', 'Sissoko', 'Mendy', 'Diaby', 'Kanté', 'Fofana', 'Cissé', 'Ndiaye', 'Gueye'];
const AF_FIRST = ['Moussa', 'Ibrahima', 'Mamadou', 'Sadio', 'Cheikh', 'Ismaïla', 'Victor', 'Samuel', 'Emmanuel', 'Kelechi', 'Wilfried', 'Franck', 'Serge', 'Yves', 'Kalidou', 'Idrissa', 'Thomas', 'Joseph', 'André', 'Achraf', 'Youssef', 'Hakim', 'Sofiane', 'Riyad', 'Mohamed', 'Kwame', 'Abdul', 'Yaw', 'Bamidele', 'Ademola'];
const AF_LAST = ['Diallo', 'Ndiaye', 'Sarr', 'Mané', 'Gueye', 'Koulibaly', 'Osimhen', 'Iheanacho', 'Ndidi', 'Zaha', 'Kessié', 'Aurier', 'Bamba', 'Touré', 'Haller', 'Mbeumo', 'Onana', 'Anguissa', 'Aboubakar', 'Partey', 'Kudus', 'Ayew', 'Ziyech', 'En-Nesyri', 'Amrabat', 'Mahrez', 'Bennacer', 'Salah', 'Trezeguet', 'Lookman', 'Boniface', 'Chukwueze', 'Doucouré', 'Bissouma', 'Traoré'];
const NORD_FIRST = ['Erik', 'Lars', 'Magnus', 'Kristian', 'Andreas', 'Mathias', 'Oscar', 'Emil', 'Viktor', 'Anders', 'Rasmus', 'Mikkel', 'Jesper', 'Joakim', 'Sander', 'Henrik', 'Sindre', 'Jonas', 'Gustav', 'Isak'];
const NORD_LAST = ['Hansen', 'Johansen', 'Olsen', 'Larsen', 'Andersen', 'Nielsen', 'Pedersen', 'Kristiansen', 'Jensen', 'Karlsson', 'Lindqvist', 'Berg', 'Holm', 'Lund', 'Dahl', 'Strand', 'Eriksen', 'Nygaard', 'Svensson', 'Bakke'];
const EE_FIRST = ['Luka', 'Ivan', 'Marko', 'Nikola', 'Josip', 'Dušan', 'Filip', 'Mateo', 'Petar', 'Stefan', 'Jakub', 'Robert', 'Piotr', 'Tomáš', 'Milan', 'Andrej', 'Dominik', 'Lovro', 'Martin', 'Kamil'];
const EE_LAST = ['Novak', 'Horvat', 'Kovačić', 'Babić', 'Marić', 'Jurić', 'Petrović', 'Jovanović', 'Nikolić', 'Kowalski', 'Nowak', 'Wiśniewski', 'Dvořák', 'Svoboda', 'Kovač', 'Perišić', 'Brozović', 'Milinković', 'Zieliński', 'Szymański'];
const NL_FIRST = ['Daan', 'Sem', 'Luuk', 'Jesse', 'Bram', 'Thijs', 'Joey', 'Noa', 'Teun', 'Jurriën', 'Kevin', 'Romelu', 'Axel', 'Dries', 'Youri', 'Arthur', 'Wout', 'Jens', 'Jeremy', 'Timothy'];
const NL_LAST = ['de Jong', 'Jansen', 'de Vries', 'van den Berg', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'Peeters', 'Maes', 'Jacobs', 'Willems', 'Claes', 'Goossens', 'Vermeulen', 'van Dijk', 'Dekker', 'Hendriks'];
const PT_PT_FIRST = ['João', 'Diogo', 'Rúben', 'Gonçalo', 'Tiago', 'Bernardo', 'Nuno', 'Rafael', 'Francisco', 'Rodrigo', 'André', 'Pedro', 'Vítor', 'Renato', 'Fábio'];
const PT_PT_LAST = ['Silva', 'Pereira', 'Costa', 'Martins', 'Ferreira', 'Neves', 'Mendes', 'Dias', 'Cancelo', 'Carvalho', 'Moutinho', 'Leão', 'Ramos', 'Conceição', 'Inácio'];
const JP_FIRST = ['Takumi', 'Kaoru', 'Daichi', 'Ritsu', 'Wataru', 'Takefusa', 'Hiroki', 'Ko', 'Junya', 'Ayase'];
const JP_LAST = ['Minamino', 'Mitoma', 'Kamada', 'Doan', 'Endo', 'Kubo', 'Ito', 'Itakura', 'Tomiyasu', 'Ueda'];
const US_FIRST = ['Christian', 'Tyler', 'Weston', 'Gio', 'Sergiño', 'Brenden', 'Ricardo', 'Folarin', 'Antonee', 'Matt', 'Alphonso', 'Jonathan', 'Cyle', 'Tajon', 'Ismael'];
const US_LAST = ['Pulido', 'Adams', 'McKennie', 'Reyna', 'Dest', 'Aaronson', 'Pepi', 'Balogun', 'Robinson', 'Turner', 'David', 'Larin', 'Buchanan', 'Kone', 'Eustáquio'];

export const NAME_POOLS: Record<string, NamePool> = {
  BRA: { first: PT_FIRST, last: PT_LAST, nick: 0.18 },
  POR: { first: PT_PT_FIRST, last: PT_PT_LAST },
  ARG: { first: ES_FIRST, last: ES_LAST },
  URU: { first: ES_FIRST, last: ES_LAST },
  CHI: { first: ES_FIRST, last: ES_LAST },
  PAR: { first: ES_FIRST, last: ES_LAST },
  PER: { first: ES_FIRST, last: ES_LAST },
  BOL: { first: ES_FIRST, last: ES_LAST },
  VEN: { first: ES_FIRST, last: ES_LAST },
  MEX: { first: ES_FIRST, last: ES_LAST },
  COL: { first: ES_FIRST, last: COL_LAST },
  ECU: { first: ES_FIRST, last: ECU_LAST },
  ENG: { first: EN_FIRST, last: EN_LAST },
  SCO: { first: EN_FIRST, last: EN_LAST },
  USA: { first: US_FIRST, last: US_LAST },
  CAN: { first: US_FIRST, last: US_LAST },
  ESP: { first: ESP_FIRST, last: ESP_LAST },
  ITA: { first: IT_FIRST, last: IT_LAST },
  GER: { first: DE_FIRST, last: DE_LAST },
  AUT: { first: DE_FIRST, last: DE_LAST },
  SUI: { first: DE_FIRST, last: DE_LAST },
  FRA: { first: FR_FIRST, last: FR_LAST },
  NED: { first: NL_FIRST, last: NL_LAST },
  BEL: { first: NL_FIRST, last: NL_LAST },
  NOR: { first: NORD_FIRST, last: NORD_LAST },
  SWE: { first: NORD_FIRST, last: NORD_LAST },
  DEN: { first: NORD_FIRST, last: NORD_LAST },
  ISL: { first: NORD_FIRST, last: NORD_LAST },
  CRO: { first: EE_FIRST, last: EE_LAST },
  SRB: { first: EE_FIRST, last: EE_LAST },
  POL: { first: EE_FIRST, last: EE_LAST },
  CZE: { first: EE_FIRST, last: EE_LAST },
  SVN: { first: EE_FIRST, last: EE_LAST },
  SVK: { first: EE_FIRST, last: EE_LAST },
  HUN: { first: EE_FIRST, last: EE_LAST },
  UKR: { first: EE_FIRST, last: EE_LAST },
  GEO: { first: EE_FIRST, last: EE_LAST },
  TUR: { first: EE_FIRST, last: EE_LAST },
  NGA: { first: AF_FIRST, last: AF_LAST },
  SEN: { first: AF_FIRST, last: AF_LAST },
  CIV: { first: AF_FIRST, last: AF_LAST },
  CMR: { first: AF_FIRST, last: AF_LAST },
  GHA: { first: AF_FIRST, last: AF_LAST },
  MAR: { first: AF_FIRST, last: AF_LAST },
  ALG: { first: AF_FIRST, last: AF_LAST },
  EGY: { first: AF_FIRST, last: AF_LAST },
  GUI: { first: AF_FIRST, last: AF_LAST },
  MLI: { first: AF_FIRST, last: AF_LAST },
  JPN: { first: JP_FIRST, last: JP_LAST },
  KOR: { first: JP_FIRST, last: JP_LAST },
};

/** Nacionalidades estrangeiras plausíveis por país do clube (para contratações e geração). */
export const FOREIGN_MIX: Record<string, string[]> = {
  BRA: ['ARG', 'URU', 'COL', 'PAR', 'ECU', 'CHI', 'VEN', 'POR'],
  ARG: ['URU', 'PAR', 'COL', 'CHI', 'BRA', 'VEN'],
  URU: ['ARG', 'BRA', 'PAR'],
  CHI: ['ARG', 'URU', 'COL', 'VEN'],
  COL: ['VEN', 'ARG', 'ECU'],
  ECU: ['COL', 'ARG', 'URU'],
  PAR: ['ARG', 'URU', 'BRA'],
  PER: ['ARG', 'URU', 'COL', 'VEN'],
  BOL: ['ARG', 'PAR', 'BRA', 'COL'],
  VEN: ['COL', 'ARG'],
  ENG: ['FRA', 'ESP', 'POR', 'BRA', 'NED', 'BEL', 'NGA', 'GHA', 'NOR', 'DEN', 'SCO', 'ARG', 'GER', 'USA'],
  ESP: ['ARG', 'BRA', 'FRA', 'URU', 'COL', 'POR', 'MAR', 'NED'],
  ITA: ['ARG', 'BRA', 'FRA', 'SRB', 'CRO', 'NED', 'NGA', 'SEN', 'POL', 'DEN'],
  GER: ['AUT', 'SUI', 'FRA', 'NED', 'CRO', 'POL', 'JPN', 'DEN', 'USA', 'GHA'],
  FRA: ['SEN', 'CIV', 'MAR', 'ALG', 'MLI', 'CMR', 'GUI', 'BRA', 'POR', 'BEL'],
};
