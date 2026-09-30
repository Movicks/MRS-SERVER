import { PartialType } from '@nestjs/swagger';
import { CreatePriceItemDto } from './create-price-item.dto';

export class UpdatePriceItemDto extends PartialType(CreatePriceItemDto) {}
