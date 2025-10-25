// src/fussballverein/dto/stadion.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

/**
 * DTO-Klasse für ein Stadion mit spezifischer Validierung.
 */
export class StadionDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(60)
    @ApiProperty({ example: 'München', type: String, maxLength: 60 })
    readonly stadt!: string;

    @IsInt()
    @Min(1) // Ein Stadion sollte mindestens 1 Platz haben
    @Max(200000) // Obergrenze für die Kapazität
    @ApiProperty({ example: 75000, type: Number, minimum: 1, maximum: 200000 })
    readonly kapazitaet!: number;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    @ApiProperty({
        example: 'Werner-Heisenberg-Allee',
        type: String,
        maxLength: 100,
    })
    readonly strasse?: string;

    @IsString()
    @IsOptional()
    @MaxLength(10)
    @ApiProperty({ example: '25', type: String, maxLength: 10 })
    readonly hausnummer?: string;
}
