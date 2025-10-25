/**
 * Das Modul besteht aus Typdefinitionen für die Suche in `FussballvereinService`.
 * @packageDocumentation
 */

// Typdefinition für `find`
export type Suchparameter = {
    readonly id?: number;
    readonly name?: string;
    readonly gruendungsjahr?: number;
    readonly mitgliederzahl?: number;
    readonly liga?: string;
    readonly ort?: string;
    readonly land?: string;
    readonly javascript?: string;
    readonly typescript?: string;
    readonly java?: string;
    readonly python?: string;
};

// gueltige Namen fuer die Suchparameter
export const suchparameterNamen = [
    'id',
    'name',
    'gruendungsjahr',
    'mitgliederzahl',
    'liga',
    'ort',
    'land',
    'schlagwoerter',
];
