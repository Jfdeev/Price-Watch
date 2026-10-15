import { useEffect, useMemo, useState } from "react";
import { PencilLine, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table";
import {
  listCategories,
  listStores,
  createProduct,
  deleteProduct,
  getShowcaseProducts,
  updateProduct,
  type CategoryRecord,
  type StoreRecord,
  type Product
} from "../services/api";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

type ProductFormState = {
  name: string;
  price: string;
  category: string;
  storeName: string;
  productUrl: string;
  imageUrl: string;
};

const emptyForm: ProductFormState = {
  name: "",
  price: "",
  category: "",
  storeName: "",
  productUrl: "",
  imageUrl: ""
};

export function AdminProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);

  async function refreshProducts() {
    try {
      const result = await getShowcaseProducts({ page: 1, limit: 24 });
      setProducts(result.products);
    } catch {
      setProducts([]);
      toast.error("Nao foi possivel carregar os produtos.");
    }
  }

  async function refreshReferences() {
    try {
      const [storeRecords, categoryRecords] = await Promise.all([listStores(), listCategories()]);
      setStores(
        storeRecords.filter(
          (item) => item.isActive && (item.userId ? item.userId === user?.id : true)
        )
      );
      setCategories(categoryRecords.filter((item) => item.isActive));
    } catch {
      setStores([]);
      setCategories([]);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshProducts();
    void refreshReferences();
  }, [user?.id]);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => product.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [products, searchQuery]
  );

  function openCreateDialog() {
    setEditingProduct(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEditDialog(product: Product) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      price: String(product.price),
      category: product.category ?? "",
      storeName: product.storeName ?? "",
      productUrl: product.productUrl ?? "",
      imageUrl: product.imageUrl ?? ""
    });
    setOpen(true);
  }

  async function handleSubmit() {
    const parsedPrice = Number(form.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error("Informe um preco valido.");
      return;
    }

    if (!form.storeName) {
      toast.error("Selecione uma loja ativa para salvar o produto.");
      return;
    }

    try {
      if (editingProduct) {
        const updated = await updateProduct(editingProduct.id, {
          name: form.name.trim(),
          price: parsedPrice,
          category: form.category.trim() || null,
          storeName: form.storeName.trim() || null,
          productUrl: form.productUrl.trim() || null,
          imageUrl: form.imageUrl.trim() || null
        });

        setProducts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Produto atualizado com sucesso!");
      } else {
        const created = await createProduct({
          name: form.name.trim(),
          price: parsedPrice,
          category: form.category.trim() || null,
          storeName: form.storeName.trim() || null,
          productUrl: form.productUrl.trim() || null,
          imageUrl: form.imageUrl.trim() || null
        });

        setProducts((current) => [created, ...current]);
        toast.success("Produto criado com sucesso!");
      }

      setOpen(false);
      setEditingProduct(null);
      setForm(emptyForm);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel salvar o produto.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProduct(id);
      setProducts((current) => current.filter((item) => item.id !== id));
      toast.success("Produto removido com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel remover o produto.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground mt-2">
            CRUD administrativo de produtos monitorados pelo PriceWatch.
          </p>
        </div>

        <Button className="bg-violet-600 hover:bg-violet-700" onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Novo produto
        </Button>
      </div>

      <Card className="p-6">
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar produto"
            className="pl-10"
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Preco</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium max-w-xs truncate">{product.name}</TableCell>
                  <TableCell>R$ {Number(product.price).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{product.category ?? "-"}</TableCell>
                  <TableCell>{product.storeName ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                        <PencilLine className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>
              Cadastre produtos manualmente para manter o catalogo administrativo completo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="product-name">Nome</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-price">Preco</Label>
              <Input
                id="product-price"
                type="number"
                value={form.price}
                onChange={(event) =>
                  setForm((current) => ({ ...current, price: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-category">Categoria</Label>
              <select
                id="product-category"
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({ ...current, category: event.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-store">Loja</Label>
              <select
                id="product-store"
                value={form.storeName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, storeName: event.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="">Selecione uma loja</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.name}>
                    {store.name}
                  </option>
                ))}
              </select>
              {stores.length === 0 ? (
                <p className="text-xs text-red-600">
                  Cadastre uma loja ativa antes de criar um produto.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-url">URL do produto</Label>
              <Input
                id="product-url"
                value={form.productUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, productUrl: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-image">URL da imagem</Label>
              <Input
                id="product-image"
                value={form.imageUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, imageUrl: event.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={() => void handleSubmit()}
              disabled={stores.length === 0}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
