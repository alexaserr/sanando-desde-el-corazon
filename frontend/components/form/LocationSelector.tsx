"use client";

import { useEffect } from "react";

// ─── Data ───────────────────────────────────────────────────────────────────

const MEXICO_STATES = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas",
  "Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México",
  "Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit",
  "Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí",
  "Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas",
];

const SPAIN_COMMUNITIES = [
  "Andalucía","Aragón","Asturias","Baleares","Canarias","Cantabria",
  "Castilla-La Mancha","Castilla y León","Cataluña","Comunidad Valenciana",
  "Extremadura","Galicia","La Rioja","Madrid","Murcia","Navarra","País Vasco",
];

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Carolina del Norte",
  "Carolina del Sur","Colorado","Connecticut","Dakota del Norte","Dakota del Sur",
  "Delaware","Florida","Georgia","Hawái","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Luisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Misisipi","Misuri","Montana","Nebraska","Nevada","Nueva Hampshire",
  "Nueva Jersey","Nuevo Mexico","Nueva York","Ohio","Oklahoma","Oregón",
  "Pensilvania","Rhode Island","Tennessee","Texas","Utah","Vermont","Virginia",
  "Virginia Occidental","Washington","Wisconsin","Wyoming",
];

const FAVORITE_COUNTRIES = ["Mexico", "Espana", "Estados Unidos"];

const OTHER_COUNTRIES = [
  "Afganistan","Albania","Alemania","Andorra","Angola","Antigua y Barbuda",
  "Arabia Saudita","Argelia","Argentina","Armenia","Australia","Austria",
  "Azerbaiyan","Bahamas","Banglades","Barbados","Barein","Belgica","Belice",
  "Benin","Bielorrusia","Birmania","Bolivia","Bosnia y Herzegovina","Botsuana",
  "Brasil","Brunei","Bulgaria","Burkina Faso","Burundi","Butan","Cabo Verde",
  "Camboya","Camerun","Canada","Catar","Chad","Chile","China","Chipre",
  "Colombia","Comoras","Corea del Norte","Corea del Sur","Costa de Marfil",
  "Costa Rica","Croacia","Cuba","Dinamarca","Dominica","Ecuador","Egipto",
  "El Salvador","Emiratos Arabes Unidos","Eritrea","Eslovaquia","Eslovenia",
  "Estonia","Esuatini","Etiopia","Filipinas","Finlandia","Fiyi","Francia",
  "Gabon","Gambia","Georgia","Ghana","Granada","Grecia","Guatemala","Guinea",
  "Guinea-Bisau","Guinea Ecuatorial","Guyana","Haiti","Honduras","Hungria",
  "India","Indonesia","Irak","Iran","Irlanda","Islandia","Islas Marshall",
  "Islas Salomon","Israel","Italia","Jamaica","Japon","Jordania","Kazajistan",
  "Kenia","Kirguistan","Kiribati","Kuwait","Laos","Lesoto","Letonia","Libano",
  "Liberia","Libia","Liechtenstein","Lituania","Luxemburgo","Macedonia del Norte",
  "Madagascar","Malasia","Malaui","Maldivas","Mali","Malta","Marruecos",
  "Mauricio","Mauritania","Micronesia","Moldavia","Monaco","Mongolia",
  "Montenegro","Mozambique","Namibia","Nauru","Nepal","Nicaragua","Niger",
  "Nigeria","Noruega","Nueva Zelanda","Oman","Paises Bajos","Pakistan","Palaos",
  "Panama","Papua Nueva Guinea","Paraguay","Peru","Polonia","Portugal",
  "Reino Unido","Republica Centroafricana","Republica Checa",
  "Republica Democratica del Congo","Republica Dominicana","Republica del Congo",
  "Ruanda","Rumania","Rusia","Samoa","San Cristobal y Nieves","San Marino",
  "San Vicente y las Granadinas","Santa Lucia","Santo Tome y Principe","Senegal",
  "Serbia","Seychelles","Sierra Leona","Singapur","Siria","Somalia","Sri Lanka",
  "Sudafrica","Sudan","Sudan del Sur","Suecia","Suiza","Surinam","Tailandia",
  "Tanzania","Tayikistan","Timor Oriental","Togo","Tonga","Trinidad y Tobago",
  "Tunez","Turkmenistan","Turquia","Tuvalu","Ucrania","Uganda","Uruguay",
  "Uzbekistan","Vanuatu","Vaticano","Venezuela","Vietnam","Yemen","Yibuti",
  "Zambia","Zimbabue",
];

// ─── Component ──────────────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full h-11 border-0 border-b border-terra-500 bg-terra-50 rounded-none px-3 text-sm text-terra-900 focus:outline-none focus:ring-0 focus:border-b-2 focus:border-terra-700 transition-colors";

interface LocationSelectorProps {
  countryValue: string;
  stateValue: string;
  onCountryChange: (value: string) => void;
  onStateChange: (value: string) => void;
  countryId: string;
  stateId: string;
  countryLabel: string;
  stateLabel: string;
  countryError?: string;
  stateError?: string;
}

export default function LocationSelector({
  countryValue,
  stateValue,
  onCountryChange,
  onStateChange,
  countryId,
  stateId,
  countryLabel,
  stateLabel,
  countryError,
  stateError,
}: LocationSelectorProps) {
  // Reset state when country changes
  useEffect(() => {
    onStateChange("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryValue]);

  const stateOptions = getStateOptions(countryValue);
  const isFreeText = countryValue !== "" && stateOptions === null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Country */}
      <div>
        <label
          htmlFor={countryId}
          className="mb-1 block text-xs uppercase tracking-[0.1em] font-bold text-[#4A3628]"
          style={{ fontFamily: "Lato, sans-serif" }}
        >
          {countryLabel} <span className="text-[#C4704A]">*</span>
        </label>
        <select
          id={countryId}
          value={countryValue}
          onChange={(e) => onCountryChange(e.target.value)}
          className={INPUT_CLS}
        >
          <option value="">Seleccionar...</option>
          <optgroup label="Frecuentes">
            {FAVORITE_COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </optgroup>
          <optgroup label="Otros países">
            {OTHER_COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </optgroup>
        </select>
        {countryError && (
          <p className="mt-1 text-xs text-red-600">{countryError}</p>
        )}
      </div>

      {/* State / Province */}
      <div>
        <label
          htmlFor={stateId}
          className="mb-1 block text-xs uppercase tracking-[0.1em] font-bold text-[#4A3628]"
          style={{ fontFamily: "Lato, sans-serif" }}
        >
          {stateLabel} <span className="text-[#C4704A]">*</span>
        </label>
        {isFreeText ? (
          <input
            id={stateId}
            type="text"
            value={stateValue}
            onChange={(e) => onStateChange(e.target.value)}
            className={INPUT_CLS}
            placeholder="Estado / Provincia"
          />
        ) : (
          <select
            id={stateId}
            value={stateValue}
            onChange={(e) => onStateChange(e.target.value)}
            className={INPUT_CLS}
            disabled={!countryValue}
          >
            <option value="">
              {countryValue ? "Seleccionar..." : "Primero selecciona país"}
            </option>
            {stateOptions?.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        {stateError && (
          <p className="mt-1 text-xs text-red-600">{stateError}</p>
        )}
      </div>
    </div>
  );
}

function getStateOptions(country: string): string[] | null {
  switch (country) {
    case "Mexico":
      return MEXICO_STATES;
    case "Espana":
      return SPAIN_COMMUNITIES;
    case "Estados Unidos":
      return US_STATES;
    default:
      // Free text for unknown countries, null = no predefined list
      return country ? null : [];
  }
}
