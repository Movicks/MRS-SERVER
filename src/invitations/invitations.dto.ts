import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteDoctorDto {
    @ApiProperty({ example: 'doctor@example.com' })
    @IsEmail({}, { message: 'Must be a valid email address' })
    @IsNotEmpty()
    email: string;
}

export class AcceptInvitationDto {
    @ApiProperty({ example: 'doctor@example.com' })
    @IsEmail({}, { message: 'Must be a valid email address' })
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'abc123tokenhere' })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({ example: 'SecureP@ssw0rd', minLength: 8 })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password: string;

    @ApiPropertyOptional({ example: 'Dr. John Smith' })
    @IsString()
    @IsOptional()
    name?: string;
}
