// types.ts — Interfaces para os dados retornados pelas APIs do IBGE

export interface Regiao {
  id: number;
  sigla: string;
  nome: string;
}

export interface Estado {
  id: number;
  sigla: string;
  nome: string;
  regiao: Regiao;
}

export interface Municipio {
  id: number;
  nome: string;
  microrregiao: {
    id: number;
    nome: string;
    mesorregiao: {
      id: number;
      nome: string;
      UF: { id: number; sigla: string; nome: string; regiao: Regiao };
    };
  };
  "regiao-imediata": {
    id: number;
    nome: string;
    "regiao-intermediaria": {
      id: number;
      nome: string;
      UF: { id: number; sigla: string; nome: string };
    };
  };
}

export interface MunicipioSimples {
  id: number;
  nome: string;
  uf_sigla?: string;
  uf_nome?: string;
  mesorregiao?: string;
  microrregiao?: string;
}

export interface SidraAgregado {
  id: string;
  nome: string;
  URL: string;
  pesquisaID: string;
  pesquisaNome: string;
  periodicidade: { frequencia: string; inicio: string; fim: string };
  assuntos: Array<{ id: string; nome: string }>;
  nivelTerritorial: { Administrativo: string[]; Especial: string[]; IBGE: string[] };
  variaveis: Array<{ id: string; nome: string; unidade: string }>;
  classificacoes: Array<{
    id: string;
    nome: string;
    sumarizacao: string[];
    categorias: Array<{ id: string; nome: string; unidade: string }>;
  }>;
}

export interface SidraResultado {
  id: string;
  variavel: string;
  unidade: string;
  resultados: Array<{
    classificacoes: Array<{ id: string; nome: string; categoria: Record<string, string> }>;
    series: Array<{
      localidade: { id: string; nivel: { id: string; nome: string }; nome: string };
      serie: Record<string, string>;
    }>;
  }>;
}

export interface Noticia {
  id: number;
  tipo: string;
  titulo: string;
  introducao: string;
  data_publicacao: string;
  produto_id: string;
  produto: string;
  editorias: string;
  imagens: string;
  link: string;
}

export interface Pais {
  id: {
    "M49": number;
    "ISO-3166-1-ALPHA-2": string;
    "ISO-3166-1-ALPHA-3": string;
  };
  nome: {
    abreviado: string;
    "abreviado-EN": string;
    "abreviado-ES": string;
  };
  area: {
    total: string;
    unidade: {
      nome: string;
      símbolo: string;
      multiplicador: number;
    };
  };
  localizacao: {
    regiao: {
      id: { M49: number };
      nome: string;
    };
    "sub-regiao": {
      id: { M49: number };
      nome: string;
    };
    "regiao-intermediaria": {
      id: { M49: number };
      nome: string;
    } | null;
  };
  linguas: Array<{
    id: {
      "ISO-639-1": string;
      "ISO-639-2": string;
    };
    nome: string;
  }>;
  governo: {
    capital: {
      nome: string;
    };
  };
  "unidades-monetarias": Array<{
    id: {
      "ISO-4217-ALPHA": string;
      "ISO-4217-NUMERICO": string;
    };
    nome: string;
  }>;
  historico: string;
}

export interface IndicadorPais {
  id: number;
  indicador: string;
  unidade: {
    id: string;
    classe: string;
    multiplicador: number;
  };
}

export interface IndicadorPaisSerie {
  id: number;
  indicador: string;
  unidade: {
    id: string;
    classe: string;
    multiplicador: number;
  } | null;
  series: Array<{
    pais: {
      id: string;
      nome: string;
    };
    serie: Array<Record<string, string | null>>;
  }>;
}

export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  [key: string]: unknown;
}
