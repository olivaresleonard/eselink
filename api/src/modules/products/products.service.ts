import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductStatus } from '../../common/entities/domain.enums.js';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { OperationContextService } from '../../core/operation-context/operation-context.service.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import { Product } from './product.entity.js';
import { ProductsRepository } from './products.repository.js';

@Injectable()
export class ProductsService extends BaseDomainService {
  constructor(
    repository: ProductsRepository,
    @InjectRepository(Product)
    private readonly productsOrmRepository: Repository<Product>,
    private readonly operationContextService: OperationContextService,
    private readonly configService: ConfigService,
  ) {
    super(repository);
  }

  async create(data: Record<string, unknown>) {
    const dto = data as unknown as CreateProductDto;
    const workspaceId =
      dto.workspaceId ?? (await this.operationContextService.getDefaultWorkspaceId());

    return this.productsOrmRepository.save(
      this.productsOrmRepository.create({
        workspaceId,
        title: dto.name,
        description: dto.description ?? null,
        internalCategory: dto.internalCategory?.trim() || null,
        attributes: this.buildAttributes(dto),
        status: ProductStatus.ACTIVE,
      }),
    );
  }

  findAll() {
    return this.productsOrmRepository.find({
      relations: { variants: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const product = await this.productsOrmRepository.findOne({
      where: { id },
      relations: { variants: true, listings: true },
    });

    if (!product) {
      throw new NotFoundException(`products ${id} not found`);
    }

    return product;
  }

  async update(id: string, data: Record<string, unknown>) {
    const product = await this.productsOrmRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`products ${id} not found`);
    }

    const incomingAttributes =
      typeof data.attributes === 'object' && data.attributes !== null
        ? (data.attributes as Record<string, unknown>)
        : undefined;

    const mergedAttributes =
      incomingAttributes === undefined
        ? product.attributes ?? null
        : {
            ...(product.attributes ?? {}),
            ...incomingAttributes,
          };

    const merged = this.productsOrmRepository.merge(product, {
      ...data,
      attributes: mergedAttributes,
    });

    return this.productsOrmRepository.save(merged);
  }

  async generateInternalImage(data: Record<string, unknown>) {
    const productTitle =
      typeof data.productTitle === 'string' && data.productTitle.trim().length > 0
        ? data.productTitle.trim()
        : 'producto';
    const referenceImageUrl =
      typeof data.referenceImageUrl === 'string' && data.referenceImageUrl.trim().length > 0
        ? data.referenceImageUrl.trim()
        : null;
    const mode =
      data.mode === 'match' || data.mode === 'enhance' ? data.mode : 'enhance';
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!referenceImageUrl) {
      throw new BadRequestException('Debes enviar una imagen de referencia.');
    }

    if (!apiKey) {
      throw new BadRequestException(
        'Falta configurar OPENAI_API_KEY para generar imagenes con IA.',
      );
    }

    const imageBlob = await this.loadReferenceImage(referenceImageUrl);
    const formData = new FormData();
    formData.set('model', 'gpt-image-1');
    formData.set('prompt', this.buildImagePrompt(productTitle, mode));
    formData.set('size', '1024x1024');
    formData.set('quality', mode === 'match' ? 'medium' : 'high');
    formData.set('input_fidelity', 'high');
    formData.append('image', imageBlob, 'reference.png');

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | { data?: Array<{ b64_json?: string }>; error?: { message?: string } }
      | null;

    if (!response.ok) {
      throw new InternalServerErrorException(
        payload?.error?.message ??
          'No pudimos generar la imagen interna con IA.',
      );
    }

    const base64Image = payload?.data?.[0]?.b64_json;

    if (!base64Image) {
      throw new InternalServerErrorException(
        'La respuesta de IA no trajo una imagen utilizable.',
      );
    }

    return {
      imageDataUrl: `data:image/png;base64,${base64Image}`,
      mode,
    };
  }

  private buildAttributes(dto: CreateProductDto) {
    const attributes: Record<string, unknown> = {};

    if (dto.variantType) {
      attributes.variantType = dto.variantType;
    }

    if (dto.internalImageUrl?.trim()) {
      attributes.internalImageUrl = dto.internalImageUrl.trim();
    }

    if (dto.internalImageReferenceUrl?.trim()) {
      attributes.internalImageReferenceUrl = dto.internalImageReferenceUrl.trim();
    }

    if (dto.internalImageSource?.trim()) {
      attributes.internalImageSource = dto.internalImageSource.trim();
    }

    if (dto.internalImageAiMode?.trim()) {
      attributes.internalImageAiMode = dto.internalImageAiMode.trim();
    }

    return Object.keys(attributes).length > 0 ? attributes : null;
  }

  private buildImagePrompt(productTitle: string, mode: 'match' | 'enhance') {
    if (mode === 'match') {
      return `Create a clean ecommerce product photo for "${productTitle}" using the reference image. Keep the product exactly the same: same shape, colors, materials, parts, labels, proportions and accessories. Do not add or remove elements. Use a neutral studio background, centered composition, soft professional lighting, sharp focus, no text, no watermark.`;
    }

    return `Create a premium ecommerce product photo for "${productTitle}" using the reference image. Preserve the exact product identity, colors, proportions, materials, labels and accessories, but improve lighting, clarity and presentation for online sales. Use a clean studio background, centered composition, crisp focus, no text, no watermark.`;
  }

  private async loadReferenceImage(referenceImageUrl: string) {
    if (referenceImageUrl.startsWith('data:')) {
      const match = referenceImageUrl.match(/^data:(.+?);base64,(.+)$/);

      if (!match) {
        throw new BadRequestException('La imagen subida no tiene un formato valido.');
      }

      const [, mimeType, base64Payload] = match;
      const imageBuffer = Buffer.from(base64Payload ?? '', 'base64');
      return new Blob([new Uint8Array(imageBuffer)], {
        type: mimeType ?? 'image/png',
      });
    }

    const response = await fetch(referenceImageUrl);

    if (!response.ok) {
      throw new BadRequestException('No pudimos descargar la imagen desde la URL indicada.');
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'image/png';

    return new Blob([arrayBuffer], {
      type: contentType,
    });
  }
}
