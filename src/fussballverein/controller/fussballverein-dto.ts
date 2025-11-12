// src/fussballverein/dto/fussballverein.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsEmail,
    IsISO8601,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPhoneNumber,
    IsString,
    IsUrl,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { SpielerDto } from './spieler-dto.js';
import { StadionDto } from './stadion-dto.js';

/**
 * Basis-DTO für einen Fussballverein, ohne die zugehörigen
 * Spieler und das Stadion.
 */
export class FussballvereinDtoOhneRef {
    @IsString()
    @IsNotEmpty()
    @MaxLength(60)
    @ApiProperty({ example: 'FC Bayern München', type: String, maxLength: 60 })
    readonly name!: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    @ApiProperty({ example: 300000, type: Number, minimum: 0 })
    readonly mitgliederanzahl?: number;

    @IsUrl()
    @IsOptional()
    @ApiProperty({ example: 'https://fcbayern.com', type: String })
    readonly website?: string;

    @IsEmail()
    @IsOptional()
    @ApiProperty({ example: 'kontakt@fcbayern.com', type: String })
    readonly email?: string;

    @IsPhoneNumber('DE')
    @IsOptional()
    @ApiProperty({ example: '+49-89-699310', type: String })
    readonly telefonnummer?: string;

    @IsISO8601({ strict: true })
    @IsOptional()
    @ApiProperty({
        example: '1900-02-27',
        description: 'Gründungsdatum im ISO-8601 Format',
    })
    readonly gruendungsdatum?: Date | string;
}

/**
 * Erweiterte DTO, die die Basis-DTO und die Beziehungen zu
 * Stadion und Spielern enthält.
 */
export class FussballvereinDto extends FussballvereinDtoOhneRef {
    @IsOptional()
    @ValidateNested()
    @Type(() => StadionDto)
    @ApiProperty({ type: StadionDto })
    readonly stadion?: StadionDto;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SpielerDto)
    @ApiProperty({ type: [SpielerDto] })
    readonly spieler?: SpielerDto[];
}
