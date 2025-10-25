// src/fussballverein/dto/spieler.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

/**
 * DTO-Klasse für einen Spieler mit spezifischer Validierung.
 */
export class SpielerDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(40)
    @ApiProperty({ example: 'Jamal', type: String, maxLength: 40 })
    readonly vorname!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(40)
    @ApiProperty({ example: 'Musiala', type: String, maxLength: 40 })
    readonly nachname!: string;

    @IsInt()
    @Min(16) // Mindestalter für einen Profispieler (Annahme)
    @Max(60) // Höchstalter (Annahme)
    @IsOptional()
    @ApiProperty({ example: 22, type: Number, minimum: 16, maximum: 60 })
    readonly alter?: number;

    @IsString()
    @IsOptional()
    @Matches(/^(Links|Rechts|Beidfüßig)$/u)
    @ApiProperty({
        example: 'Rechts',
        type: String,
        pattern: '^(Links|Rechts|Beidfüßig)$',
    })
    readonly starkerFuss?: string;
}
