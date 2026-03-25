'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/data-table';
import {
  FieldGroup,
  FormActions,
  FormMessage,
  inputClassName,
} from '../../components/form-field';
import { Modal } from '../../components/modal';
import { PageShell } from '../../components/page-shell';
import { QueryState } from '../../components/query-state';
import { ApiError, deleteApi, fetchApi, formatCurrency, patchApi, postApi } from '../../lib/api';
import { createProductColumns, type ProductTableRow } from '../../lib/table-columns';

type ApiProduct = {
  id: string;
  title: string;
  status: 'active' | 'draft' | 'archived';
  internalReference?: string | null;
  internalCategory?: string | null;
  attributes?: {
    variantType?: string | null;
    internalImageUrl?: string | null;
    internalImageReferenceUrl?: string | null;
    internalImageSource?: string | null;
    internalImageAiMode?: 'match' | 'enhance' | null;
  } | null;
};

type ApiProductVariant = {
  id: string;
  productId: string;
  sku: string;
  price: string;
  cost?: string | null;
  currency: string;
  title?: string;
  supplierName?: string | null;
  supplierProductAlias?: string | null;
};

type ApiInventoryItem = {
  id: string;
  variantId: string;
  available: number;
  locationCode?: string | null;
};

type ApiListing = {
  id: string;
  productId: string;
  metadata?: {
    thumbnail?: string | null;
    pictures?: Array<{ url?: string | null }> | null;
  } | null;
};

type ModalKind = 'catalog' | 'edit' | null;
type CatalogTab = 'product' | 'image' | 'inventory';
type ImageInputMode = 'url' | 'upload';
type InternalImageAiMode = 'match' | 'enhance';
type ProductEditorForm = {
  name: string;
  internalCategory: string;
  variantType: string;
  sku: string;
  purchasePrice: number;
  supplierName: string;
  supplierProductAlias: string;
  internalImageUrl: string;
  internalImageReferenceUrl: string;
  internalImageSource: 'url' | 'upload' | 'ai';
  internalImageAiMode: InternalImageAiMode;
  imageInputMode: ImageInputMode;
};

const initialProductForm: ProductEditorForm = {
  name: '',
  internalCategory: '',
  variantType: 'none',
  sku: '',
  purchasePrice: 0,
  supplierName: '',
  supplierProductAlias: '',
  internalImageUrl: '',
  internalImageReferenceUrl: '',
  internalImageSource: 'url',
  internalImageAiMode: 'enhance',
  imageInputMode: 'url',
};

const initialEditForm = {
  productId: '',
  variantId: '',
  inventoryItemId: '',
  name: '' as string,
  internalCategory: '' as string,
  variantType: 'none' as 'none' | 'talla' | 'tamano',
  sku: '' as string,
  purchasePrice: 0 as number,
  supplierName: '' as string,
  supplierProductAlias: '' as string,
  availableStock: 0 as number,
  locationCode: 'default' as string,
  internalImageUrl: '' as string,
  internalImageReferenceUrl: '' as string,
  internalImageSource: 'url' as 'url' | 'upload' | 'ai',
  internalImageAiMode: 'enhance' as InternalImageAiMode,
  imageInputMode: 'url' as ImageInputMode,
};

const initialInventoryForm = {
  productVariantId: '',
  availableStock: 0,
  locationCode: 'default',
};

function generateInternalSku(name: string) {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return normalized || 'PRODUCTO';
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('No pudimos leer la imagen.'));
    };
    reader.onerror = () => reject(new Error('No pudimos leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

function InternalImageField({
  value,
  onChange,
  onGenerate,
  isGenerating,
}: {
  value: Pick<
    ProductEditorForm,
    | 'internalImageUrl'
    | 'internalImageReferenceUrl'
    | 'internalImageSource'
    | 'internalImageAiMode'
    | 'imageInputMode'
  >;
  onChange: (
    next:
      | Partial<
          Pick<
            ProductEditorForm,
            | 'internalImageUrl'
            | 'internalImageReferenceUrl'
            | 'internalImageSource'
            | 'internalImageAiMode'
            | 'imageInputMode'
          >
        >
      | ((
          current: Pick<
            ProductEditorForm,
            | 'internalImageUrl'
            | 'internalImageReferenceUrl'
            | 'internalImageSource'
            | 'internalImageAiMode'
            | 'imageInputMode'
          >,
        ) => Partial<
          Pick<
            ProductEditorForm,
            | 'internalImageUrl'
            | 'internalImageReferenceUrl'
            | 'internalImageSource'
            | 'internalImageAiMode'
            | 'imageInputMode'
          >
        >),
  ) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const activeImageUrl = value.internalImageUrl.trim();
  const referenceImageUrl = value.internalImageReferenceUrl.trim();
  const isShowingGeneratedImage =
    Boolean(activeImageUrl) &&
    Boolean(referenceImageUrl) &&
    activeImageUrl !== referenceImageUrl;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    onChange({
      imageInputMode: 'upload',
      internalImageUrl: dataUrl,
      internalImageReferenceUrl: dataUrl,
      internalImageSource: 'upload',
    });
  }

  return (
    <div className="sm:col-span-2 rounded-[1.7rem] border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.22)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-night">Imagen interna</p>
          <p className="mt-1 text-xs text-ink/55">
            Solo afecta tu catalogo interno y reportes. No cambia fotos ni publicaciones de
            Mercado Libre.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-black/5 bg-white p-1">
          {([
            { value: 'url', label: 'URL' },
            { value: 'upload', label: 'Subir archivo' },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ imageInputMode: option.value })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                value.imageInputMode === option.value
                  ? 'bg-night text-white'
                  : 'text-ink/60 hover:bg-slate-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="space-y-4">
          {value.imageInputMode === 'url' ? (
            <FieldGroup label="URL de imagen">
              <input
                value={value.imageInputMode === 'url' ? value.internalImageReferenceUrl : ''}
                onChange={(event) =>
                  onChange({
                    internalImageUrl: event.target.value,
                    internalImageReferenceUrl: event.target.value,
                    internalImageSource: 'url',
                  })
                }
                className={inputClassName()}
                placeholder="https://..."
              />
            </FieldGroup>
          ) : (
            <FieldGroup label="Archivo de imagen">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void handleFileChange(event)}
                className={`${inputClassName()} cursor-pointer file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-night`}
              />
            </FieldGroup>
          )}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <FieldGroup label="Modo IA">
              <select
                value={value.internalImageAiMode}
                onChange={(event) =>
                  onChange({
                    internalImageAiMode: event.target.value as InternalImageAiMode,
                  })
                }
                className={inputClassName()}
              >
                <option value="match">Muy fiel a la referencia</option>
                <option value="enhance">Mejorada para venta</option>
              </select>
            </FieldGroup>

            <button
              type="button"
              onClick={onGenerate}
              disabled={!referenceImageUrl || isGenerating}
              className="mt-auto rounded-2xl border border-black/10 bg-night px-4 py-3 text-sm font-semibold text-white transition hover:bg-night/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? 'Generando...' : 'Generar con IA'}
            </button>

            {isShowingGeneratedImage ? (
              <button
                type="button"
                onClick={() =>
                  onChange((current) => ({
                    internalImageUrl: current.internalImageReferenceUrl,
                    internalImageSource:
                      current.imageInputMode === 'upload' ? 'upload' : 'url',
                  }))
                }
                className="mt-auto rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-ink/75 transition hover:bg-slate-50"
              >
                Usar original
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-black/5 bg-white shadow-[0_16px_36px_-30px_rgba(15,23,42,0.35)]">
          {activeImageUrl ? (
            <img
              src={activeImageUrl}
              alt="Vista previa del producto interno"
              className="h-full min-h-[180px] w-full object-cover"
            />
          ) : (
            <div className="flex min-h-[180px] items-center justify-center px-6 text-center text-xs font-medium text-ink/45">
              Agrega una imagen interna para previsualizarla aqui.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState<ModalKind>(null);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('product');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [productSkuTouched, setProductSkuTouched] = useState(false);
  const [productAliasTouched, setProductAliasTouched] = useState(false);
  const [inventoryForm, setInventoryForm] = useState(initialInventoryForm);
  const [editForm, setEditForm] = useState(initialEditForm);

  const { data: products = [] } = useQuery({
    queryKey: ['products-options'],
    queryFn: () => fetchApi<ApiProduct[]>('/products'),
  });

  const { data: variants = [] } = useQuery({
    queryKey: ['variants-options'],
    queryFn: () => fetchApi<ApiProductVariant[]>('/product-variants'),
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory-items-options'],
    queryFn: () => fetchApi<ApiInventoryItem[]>('/inventory'),
  });

  const { data = [], isLoading, isError } = useQuery<ProductTableRow[]>({
    queryKey: ['products-page'],
    queryFn: async () => {
      const [apiProducts, apiVariants, apiInventoryItems, apiListings] = await Promise.all([
        fetchApi<ApiProduct[]>('/products'),
        fetchApi<ApiProductVariant[]>('/product-variants'),
        fetchApi<ApiInventoryItem[]>('/inventory'),
        fetchApi<ApiListing[]>('/listings'),
      ]);
      const variantsByProduct = new Map<string, ApiProductVariant[]>();
      const stockByVariant = new Map<string, number>();
      const imageByProduct = new Map<string, string>();

      for (const variant of apiVariants) {
        const groupedVariants = variantsByProduct.get(variant.productId) ?? [];
        groupedVariants.push(variant);
        variantsByProduct.set(variant.productId, groupedVariants);
      }

      for (const inventoryItem of apiInventoryItems) {
        stockByVariant.set(
          inventoryItem.variantId,
          (stockByVariant.get(inventoryItem.variantId) ?? 0) + inventoryItem.available,
        );
      }

      for (const listing of apiListings) {
        const imageUrl =
          listing.metadata?.thumbnail ?? listing.metadata?.pictures?.[0]?.url ?? null;

        if (imageUrl && !imageByProduct.has(listing.productId)) {
          imageByProduct.set(listing.productId, imageUrl);
        }
      }

      return apiProducts.map((product) => {
        const groupedVariants = variantsByProduct.get(product.id) ?? [];
        const primaryVariant = groupedVariants[0];
        const stock = groupedVariants.reduce(
          (total, variant) => total + (stockByVariant.get(variant.id) ?? 0),
          0,
        );

        return {
          id: product.id,
          variantId: primaryVariant?.id ?? null,
          imageUrl: product.attributes?.internalImageUrl ?? imageByProduct.get(product.id) ?? null,
          sku:
            primaryVariant?.sku ??
            product.internalReference ??
            product.id.slice(0, 8).toUpperCase(),
          title: product.title,
          internalCategory: product.internalCategory?.trim() || 'Sin categoría',
          variantType:
            product.attributes?.variantType === 'talla' || product.attributes?.variantType === 'tamano'
              ? product.attributes.variantType
              : 'none',
          stock,
          purchasePrice:
            primaryVariant?.cost != null
              ? formatCurrency(Number(primaryVariant.cost), primaryVariant.currency)
              : 'Sin costo',
          supplier: primaryVariant?.supplierName?.trim() || 'Sin proveedor',
          supplierProductAlias: primaryVariant?.supplierProductAlias?.trim() || 'Sin alias',
        };
      });
    },
  });

  const commonOnSuccess = async () => {
    setOpenModal(null);
    setCatalogTab('product');
    setError(null);
    setProductForm(initialProductForm);
    setProductSkuTouched(false);
    setProductAliasTouched(false);
    setInventoryForm(initialInventoryForm);
    setEditForm(initialEditForm);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products-page'] }),
      queryClient.invalidateQueries({ queryKey: ['products-options'] }),
      queryClient.invalidateQueries({ queryKey: ['variants-options'] }),
    ]);
  };

  const createProduct = useMutation({
    mutationFn: async () => {
      const product = await postApi<ApiProduct>('/products', {
        name: productForm.name,
        internalCategory: productForm.internalCategory || undefined,
        variantType: productForm.variantType === 'none' ? undefined : productForm.variantType,
        internalImageUrl: productForm.internalImageUrl || undefined,
        internalImageReferenceUrl: productForm.internalImageReferenceUrl || undefined,
        internalImageSource: productForm.internalImageSource || undefined,
        internalImageAiMode: productForm.internalImageAiMode || undefined,
      });

      const variant = await postApi<ApiProductVariant>('/variants', {
        productId: product.id,
        sku: productForm.sku,
        name: productForm.name,
        basePrice: 0,
        cost: productForm.purchasePrice,
        supplierName: productForm.supplierName || undefined,
        supplierProductAlias: productForm.supplierProductAlias || undefined,
        currency: 'CLP',
      });

      await postApi('/inventory', {
        productVariantId: variant.id,
        availableStock: inventoryForm.availableStock,
        locationCode: inventoryForm.locationCode || undefined,
      });

      return { product, variant };
    },
    onSuccess: commonOnSuccess,
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'No pudimos guardar el producto base.',
      );
    },
  });

  const updateProduct = useMutation({
    mutationFn: async () => {
      await patchApi(`/products/${editForm.productId}`, {
        title: editForm.name,
        internalCategory: editForm.internalCategory || null,
        attributes: {
          variantType: editForm.variantType === 'none' ? null : editForm.variantType,
          internalImageUrl: editForm.internalImageUrl || null,
          internalImageReferenceUrl: editForm.internalImageReferenceUrl || null,
          internalImageSource: editForm.internalImageSource || null,
          internalImageAiMode: editForm.internalImageAiMode || null,
        },
      });

      await patchApi(`/variants/${editForm.variantId}`, {
        sku: editForm.sku,
        title: editForm.name,
        cost: editForm.purchasePrice,
        supplierName: editForm.supplierName || null,
        supplierProductAlias: editForm.supplierProductAlias || null,
      });

      if (editForm.inventoryItemId) {
        await patchApi(`/inventory/${editForm.inventoryItemId}`, {
          locationCode: editForm.locationCode || null,
        });

        return patchApi(`/inventory/${editForm.inventoryItemId}/stock`, {
          available: editForm.availableStock,
          reason: 'manual stock update',
        });
      }

      return postApi('/inventory', {
        productVariantId: editForm.variantId,
        availableStock: editForm.availableStock,
        locationCode: editForm.locationCode || undefined,
      });
    },
    onSuccess: commonOnSuccess,
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'No pudimos actualizar el producto.',
      );
    },
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => deleteApi(`/products/${id}`),
    onSuccess: async () => {
      setFeedback('Producto eliminado correctamente.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products-page'] }),
        queryClient.invalidateQueries({ queryKey: ['products-options'] }),
        queryClient.invalidateQueries({ queryKey: ['variants-options'] }),
      ]);
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'No pudimos eliminar el producto.',
      );
    },
  });

  const generateInternalImage = useMutation({
    mutationFn: ({
      productTitle,
      referenceImageUrl,
      mode,
    }: {
      productTitle: string;
      referenceImageUrl: string;
      mode: InternalImageAiMode;
    }) =>
      postApi<{ imageDataUrl: string; mode: InternalImageAiMode }>(
        '/products/generate-internal-image',
        {
          productTitle,
          referenceImageUrl,
          mode,
        },
      ),
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'No pudimos generar la imagen con IA.',
      );
    },
  });

  const variantOptions = useMemo(
    () =>
      variants.map((variant) => ({
        value: variant.id,
        label: `${variant.sku} · ${variant.title ?? 'SKU base'}`,
      })),
    [variants],
  );

  useEffect(() => {
    if (productSkuTouched) {
      return;
    }

    setProductForm((current) => ({
      ...current,
      sku: generateInternalSku(current.name),
    }));
  }, [productForm.name, productSkuTouched]);

  useEffect(() => {
    if (productAliasTouched) {
      return;
    }

    setProductForm((current) => ({
      ...current,
      supplierProductAlias: current.sku,
    }));
  }, [productForm.sku, productAliasTouched]);

  function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    createProduct.mutate();
  }

  function openCatalog(tab: CatalogTab) {
    setError(null);
    setCatalogTab(tab);
    setOpenModal('catalog');
  }

  function beginEditProduct(row: ProductTableRow) {
    if (!row.variantId) {
      setError('Este producto no tiene SKU base para editar la ficha completa.');
      return;
    }

    const variant = variants.find((item) => item.id === row.variantId);
    const product = products.find((item) => item.id === row.id);
    const inventoryItem = inventoryItems.find((item) => item.variantId === row.variantId);

    setError(null);
    setEditForm({
      productId: row.id,
      variantId: row.variantId,
      inventoryItemId: inventoryItem?.id ?? '',
      name: row.title,
      internalCategory: row.internalCategory === 'Sin categoría' ? '' : row.internalCategory,
      variantType: row.variantType,
      sku: variant?.sku ?? row.sku,
      purchasePrice: variant?.cost != null ? Number(variant.cost) : 0,
      supplierName: variant?.supplierName ?? '',
      supplierProductAlias: variant?.supplierProductAlias ?? '',
      availableStock: inventoryItem?.available ?? 0,
      locationCode: inventoryItem?.locationCode ?? 'default',
      internalImageUrl: product?.attributes?.internalImageUrl ?? '',
      internalImageReferenceUrl:
        product?.attributes?.internalImageReferenceUrl ??
        product?.attributes?.internalImageUrl ??
        '',
      internalImageSource:
        product?.attributes?.internalImageSource === 'upload' ||
        product?.attributes?.internalImageSource === 'ai'
          ? product.attributes.internalImageSource
          : 'url',
      internalImageAiMode: product?.attributes?.internalImageAiMode ?? 'enhance',
      imageInputMode:
        product?.attributes?.internalImageSource === 'upload' ||
        product?.attributes?.internalImageSource === 'ai'
          ? 'upload'
          : 'url',
    });
    setOpenActionMenuId(null);
    setOpenModal('edit');
  }

  function handleDeleteProduct(row: ProductTableRow) {
    const confirmed = window.confirm(`Eliminar "${row.title}" del catálogo interno?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setOpenActionMenuId(null);
    deleteProduct.mutate(row.id);
  }

  function updateProductImageForm(
    patch:
      | Partial<
          Pick<
            ProductEditorForm,
            | 'internalImageUrl'
            | 'internalImageReferenceUrl'
            | 'internalImageSource'
            | 'internalImageAiMode'
            | 'imageInputMode'
          >
        >
      | ((
          current: Pick<
            ProductEditorForm,
            | 'internalImageUrl'
            | 'internalImageReferenceUrl'
            | 'internalImageSource'
            | 'internalImageAiMode'
            | 'imageInputMode'
          >,
        ) => Partial<
          Pick<
            ProductEditorForm,
            | 'internalImageUrl'
            | 'internalImageReferenceUrl'
            | 'internalImageSource'
            | 'internalImageAiMode'
            | 'imageInputMode'
          >
        >),
  ) {
    setProductForm((current) => ({
      ...current,
      ...(typeof patch === 'function' ? patch(current) : patch),
    }));
  }

  function updateEditImageForm(
    patch:
      | Partial<
          Pick<
            typeof initialEditForm,
            | 'internalImageUrl'
            | 'internalImageReferenceUrl'
            | 'internalImageSource'
            | 'internalImageAiMode'
            | 'imageInputMode'
          >
        >
      | ((
          current: Pick<
            typeof initialEditForm,
            | 'internalImageUrl'
            | 'internalImageReferenceUrl'
            | 'internalImageSource'
            | 'internalImageAiMode'
            | 'imageInputMode'
          >,
        ) => Partial<
          Pick<
            typeof initialEditForm,
            | 'internalImageUrl'
            | 'internalImageReferenceUrl'
            | 'internalImageSource'
            | 'internalImageAiMode'
            | 'imageInputMode'
          >
        >),
  ) {
    setEditForm((current) => ({
      ...current,
      ...(typeof patch === 'function' ? patch(current) : patch),
    }));
  }

  function handleGenerateProductImage(target: 'create' | 'edit') {
    const form = target === 'create' ? productForm : editForm;
    const referenceImageUrl =
      form.internalImageReferenceUrl.trim() || form.internalImageUrl.trim();

    if (!referenceImageUrl) {
      setError('Primero agrega una imagen o URL de referencia.');
      return;
    }

    setError(null);
    generateInternalImage.mutate(
      {
        productTitle: form.name || 'producto',
        referenceImageUrl,
        mode: form.internalImageAiMode,
      },
      {
        onSuccess: (payload) => {
          const patch = {
            internalImageUrl: payload.imageDataUrl,
            internalImageReferenceUrl: referenceImageUrl,
            internalImageSource: 'ai' as const,
          };

          if (target === 'create') {
            updateProductImageForm(patch);
            return;
          }

          updateEditImageForm(patch);
        },
      },
    );
  }

  const productColumns = useMemo(
    () =>
      createProductColumns({
        openActionMenuId,
        onToggleActionMenu: (id) =>
          setOpenActionMenuId((current) => (current === id ? null : id)),
        onEditProduct: beginEditProduct,
        onDeleteProduct: handleDeleteProduct,
      }),
    [openActionMenuId],
  );

  return (
    <>
      <PageShell
        title="Catálogo interno"
        description="Organiza tu catálogo interno con visibilidad rápida de SKU, stock y datos de compra antes de publicar en los canales externos."
        actionContent={
          <button
            type="button"
            onClick={() => openCatalog('product')}
            className="rounded-2xl bg-gradient-to-r from-moss to-aurora px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-moss/20 transition hover:scale-[1.01]"
          >
            Nuevo producto
          </button>
        }
      >
        {feedback ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {feedback}
          </div>
        ) : null}
        {isLoading ? (
          <QueryState
            title="Cargando productos"
            description="Estamos armando el catálogo a partir de productos, variantes e inventario."
          />
        ) : isError ? (
          <QueryState
            title="No pudimos cargar productos"
            description="La API devolvió un error al consolidar el catálogo."
          />
        ) : (
          <DataTable
            data={data}
            columns={productColumns}
            title="Catálogo"
            description="Productos listos para mapear, publicar y sincronizar"
            searchPlaceholder="Buscar SKU o producto"
          />
        )}
      </PageShell>

      <Modal
        open={openModal === 'catalog'}
        onClose={() =>
          !createProduct.isPending &&
          setOpenModal(null)
        }
        title="Nuevo producto"
        description="Crea la ficha completa de tu producto interno. Despues puedes cargar inventario."
      >
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2 rounded-[1.3rem] border border-black/5 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.92))] p-2">
            {[
              {
                key: 'product',
                label: 'Producto',
                hint: 'Base, compra y proveedor',
                step: '01',
                disabled: false,
              },
              {
                key: 'image',
                label: 'Imagen',
                hint: 'Foto interna y version IA',
                step: '02',
                disabled: false,
              },
              {
                key: 'inventory',
                label: 'Inventario',
                hint: 'Stock central',
                step: '03',
                disabled: false,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                disabled={tab.disabled}
                onClick={() => openCatalog(tab.key as CatalogTab)}
                className={`rounded-[1.1rem] border px-3 py-3 text-left transition ${
                  catalogTab === tab.key
                    ? 'border-night bg-night text-white shadow-[0_14px_32px_-20px_rgba(15,23,42,0.75)]'
                    : 'border-white bg-white text-slate-700 hover:border-slate-200 hover:text-night'
                } ${tab.disabled ? 'cursor-not-allowed opacity-45' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${
                        catalogTab === tab.key ? 'text-white/60' : 'text-ink/40'
                      }`}
                    >
                      Paso {tab.step}
                    </p>
                    <p className="mt-2 truncate text-sm font-semibold">{tab.label}</p>
                    <p
                      className={`mt-1 line-clamp-2 text-xs ${
                        catalogTab === tab.key ? 'text-white/72' : 'text-ink/50'
                      }`}
                    >
                      {tab.hint}
                    </p>
                  </div>
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      catalogTab === tab.key
                        ? 'bg-white/12 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tab.step}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {catalogTab === 'product' ? (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                setCatalogTab('image');
              }}
            >
              <FieldGroup label="Nombre" required>
                <input
                  required
                  value={productForm.name}
                  onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                  className={inputClassName()}
                  placeholder="Polera Roja"
                />
              </FieldGroup>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup label="Categoría interna" required>
                  <input
                    required
                    value={productForm.internalCategory}
                    onChange={(event) =>
                      setProductForm({ ...productForm, internalCategory: event.target.value })
                    }
                    className={inputClassName()}
                    placeholder="Peluche, textil, hogar..."
                  />
                </FieldGroup>

                <FieldGroup label="Tipo de variante">
                  <select
                    value={productForm.variantType}
                    onChange={(event) =>
                      setProductForm({ ...productForm, variantType: event.target.value })
                    }
                    className={inputClassName()}
                  >
                    <option value="none">Sin variante</option>
                    <option value="talla">Talla</option>
                    <option value="tamano">Tamaño</option>
                  </select>
                </FieldGroup>

                <FieldGroup label="SKU interno" required>
                  <div className="space-y-2">
                    <input
                      required
                      value={productForm.sku}
                      onChange={(event) => {
                        setProductSkuTouched(true);
                        setProductForm({ ...productForm, sku: event.target.value });
                      }}
                      className={inputClassName()}
                      placeholder="Se genera automáticamente"
                    />
                    <p className="text-xs text-ink/45">
                      Codigo interno tuyo para catalogo, inventario y compras. No usa el SKU de
                      Mercado Libre.
                    </p>
                  </div>
                </FieldGroup>

                <FieldGroup label="Precio compra" required>
                  <input
                    required
                    min={0}
                    type="number"
                    value={productForm.purchasePrice}
                    onChange={(event) =>
                      setProductForm({
                        ...productForm,
                        purchasePrice: Number(event.target.value),
                      })
                    }
                    className={inputClassName()}
                    placeholder="10990"
                  />
                </FieldGroup>

                <FieldGroup label="Proveedor">
                  <input
                    value={productForm.supplierName}
                    onChange={(event) =>
                      setProductForm({ ...productForm, supplierName: event.target.value })
                    }
                    className={inputClassName()}
                    placeholder="Proveedor principal"
                  />
                </FieldGroup>

                <FieldGroup label="APP">
                  <input
                    value={productForm.supplierProductAlias}
                    onChange={(event) => {
                      setProductAliasTouched(true);
                      setProductForm({
                        ...productForm,
                        supplierProductAlias: event.target.value,
                      });
                    }}
                    className={inputClassName()}
                    placeholder="Alias producto proveedor"
                  />
                </FieldGroup>
              </div>

              {error ? <FormMessage>{error}</FormMessage> : null}
              <FormActions
                submitLabel="Continuar a imagen"
                submitting={false}
                onCancel={() => setOpenModal(null)}
              />
            </form>
          ) : null}

          {catalogTab === 'image' ? (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                setCatalogTab('inventory');
              }}
            >
              <InternalImageField
                value={productForm}
                onChange={updateProductImageForm}
                onGenerate={() => handleGenerateProductImage('create')}
                isGenerating={generateInternalImage.isPending}
              />

              {error ? <FormMessage>{error}</FormMessage> : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCatalogTab('product')}
                  className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold text-ink/70 transition hover:bg-slate-50"
                >
                  Volver
                </button>
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenModal(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-ink/70 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-moss to-aurora px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-moss/20 transition hover:scale-[1.01]"
                  >
                    Continuar a inventario
                  </button>
                </div>
              </div>
            </form>
          ) : null}

          {catalogTab === 'inventory' ? (
            <form className="space-y-5" onSubmit={handleProductSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup label="SKU interno" required>
                  <>
                    <input
                      value={productForm.sku ? `${productForm.sku} · ${productForm.name || 'Producto nuevo'}` : ''}
                      readOnly
                      className={`${inputClassName()} cursor-not-allowed bg-slate-100 text-ink/70`}
                    />
                  </>
                </FieldGroup>

                <FieldGroup label="Stock disponible" required>
                  <input
                    required
                    min={0}
                    type="number"
                    value={inventoryForm.availableStock}
                    onChange={(event) =>
                      setInventoryForm({
                        ...inventoryForm,
                        availableStock: Number(event.target.value),
                      })
                    }
                    className={inputClassName()}
                    placeholder="100"
                  />
                </FieldGroup>

                <FieldGroup label="Ubicación">
                  <input
                    value={inventoryForm.locationCode}
                    onChange={(event) =>
                      setInventoryForm({
                        ...inventoryForm,
                        locationCode: event.target.value,
                      })
                    }
                    className={inputClassName()}
                    placeholder="default"
                  />
                </FieldGroup>
              </div>

              {error ? <FormMessage>{error}</FormMessage> : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCatalogTab('image')}
                  className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-semibold text-ink/70 transition hover:bg-slate-50"
                >
                  Volver
                </button>
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenModal(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-ink/70 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createProduct.isPending}
                    className="rounded-xl bg-gradient-to-r from-moss to-aurora px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-moss/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {createProduct.isPending ? 'Guardando...' : 'Guardar producto'}
                  </button>
                </div>
              </div>
            </form>
          ) : null}

        </div>
      </Modal>

      <Modal
        open={openModal === 'edit'}
        onClose={() => !updateProduct.isPending && setOpenModal(null)}
        title="Editar producto"
        description="Edita la ficha completa del producto interno antes de publicar o comprar."
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            updateProduct.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup label="Nombre" required>
              <input
                required
                value={editForm.name}
                onChange={(event) =>
                  setEditForm({ ...editForm, name: event.target.value })
                }
                className={inputClassName()}
                placeholder="Nombre del producto"
              />
            </FieldGroup>

            <FieldGroup label="Categoría interna" required>
              <input
                required
                value={editForm.internalCategory}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    internalCategory: event.target.value,
                  })
                }
                className={inputClassName()}
                placeholder="Peluche, textil, hogar..."
              />
            </FieldGroup>

            <FieldGroup label="Tipo de variante">
              <select
                value={editForm.variantType}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    variantType: event.target.value as 'none' | 'talla' | 'tamano',
                  })
                }
                className={inputClassName()}
              >
                <option value="none">Sin variante</option>
                <option value="talla">Talla</option>
                <option value="tamano">Tamaño</option>
              </select>
            </FieldGroup>

            <FieldGroup label="SKU interno" required>
              <div className="space-y-2">
                <input
                  required
                  value={editForm.sku}
                  onChange={(event) => setEditForm({ ...editForm, sku: event.target.value })}
                  className={inputClassName()}
                  placeholder="SKU interno"
                />
                <p className="text-xs text-ink/45">
                  Codigo interno tuyo para catalogo, inventario y compras. No usa el SKU de
                  Mercado Libre.
                </p>
              </div>
            </FieldGroup>

            <FieldGroup label="Precio compra" required>
              <input
                required
                min={0}
                type="number"
                value={editForm.purchasePrice}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    purchasePrice: Number(event.target.value),
                  })
                }
                className={inputClassName()}
                placeholder="10990"
              />
            </FieldGroup>

            <FieldGroup label="Proveedor">
              <input
                value={editForm.supplierName}
                onChange={(event) =>
                  setEditForm({ ...editForm, supplierName: event.target.value })
                }
                className={inputClassName()}
                placeholder="Proveedor principal"
              />
            </FieldGroup>

            <FieldGroup label="APP" required>
              <input
                required
                value={editForm.supplierProductAlias}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    supplierProductAlias: event.target.value,
                  })
                }
                className={inputClassName()}
                placeholder="Alias producto proveedor"
              />
            </FieldGroup>

          </div>

          <InternalImageField
            value={editForm}
            onChange={updateEditImageForm}
            onGenerate={() => handleGenerateProductImage('edit')}
            isGenerating={generateInternalImage.isPending}
          />

          <div className="rounded-[1.7rem] border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.22)]">
            <div>
              <p className="text-sm font-semibold text-night">Inventario</p>
              <p className="mt-1 text-xs text-ink/55">
                Ajusta aqui el stock y la ubicacion del SKU interno principal.
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FieldGroup label="Stock disponible" required>
                <input
                  required
                  min={0}
                  type="number"
                  value={editForm.availableStock}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      availableStock: Number(event.target.value),
                    })
                  }
                  className={inputClassName()}
                  placeholder="100"
                />
              </FieldGroup>

              <FieldGroup label="Ubicación">
                <input
                  value={editForm.locationCode}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      locationCode: event.target.value,
                    })
                  }
                  className={inputClassName()}
                  placeholder="default"
                />
              </FieldGroup>
            </div>
          </div>

          {error ? <FormMessage>{error}</FormMessage> : null}
          <FormActions
            submitLabel="Guardar producto"
            submitting={updateProduct.isPending}
            onCancel={() => setOpenModal(null)}
          />
        </form>
      </Modal>
    </>
  );
}
