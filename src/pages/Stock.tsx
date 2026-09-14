import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDB, generateId } from "@/lib/localDB";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  PlusCircle, 
  Trash2, 
  Search, 
  Boxes, 
  AlertTriangle,
  Box,
  Edit,
  Loader2,
  Check,
  Minus,
  Plus
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

interface StockItem {
  id: string;
  item: string;
  buyed_from: string;
  quantity: number;
  supported_model: string;
  box_no: string;
  created_at?: string;
}

interface StockFormValues {
  item: string;
  buyed_from: string;
  quantity: number;
  supported_model: string;
  box_no: string;
}

const PART_TYPES = ["Display", "CC", "Battery", "IC", "Camera", "Speaker"];
const SUPPLIERS = ["Kaveri", "Surya", "Bangalore", "Cell Care", "Local"];

export default function Stock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<StockFormValues>({
    defaultValues: {
      item: "Display",
      buyed_from: "Kaveri",
      quantity: 1,
      supported_model: "",
      box_no: ""
    }
  });

  const { data: stocks = [], isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: async () => {
      const data = await localDB.stock.getAll();
      return (data as StockItem[]).sort((a, b) => {
        if (!a.created_at || !b.created_at) return 0;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
  });

  const addStockMutation = useMutation({
    mutationFn: async (values: StockFormValues) => {
      const currentStocks = await localDB.stock.getAll();
      const newStock: StockItem = {
        id: generateId(),
        item: values.item,
        buyed_from: values.buyed_from,
        quantity: Number(values.quantity),
        supported_model: values.supported_model,
        box_no: values.box_no,
        created_at: new Date().toISOString()
      };
      
      currentStocks.push(newStock);
      await localDB.stock.save(currentStocks);
      return newStock;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      toast({ title: "Stock Added", description: "The item has been added to inventory." });
      reset({ item: "Display", buyed_from: "Kaveri", quantity: 1, supported_model: "", box_no: "" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Operation Failed", description: err.message });
    }
  });

  const deleteStockMutation = useMutation({
    mutationFn: async (id: string) => {
      await localDB.stock.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      toast({ title: "Stock Removed", description: "The item has been deleted from inventory." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Delete Failed", description: err.message });
    }
  });

  const updateStockMutation = useMutation({
    mutationFn: async (updatedItem: StockItem) => {
      await localDB.stock.update(updatedItem.id, {
        item: updatedItem.item,
        buyed_from: updatedItem.buyed_from,
        quantity: Number(updatedItem.quantity),
        supported_model: updatedItem.supported_model,
        box_no: updatedItem.box_no
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      toast({ title: "Stock Updated", description: "Inventory item details saved successfully." });
      setEditingItem(null);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    }
  });

  const handleDelete = (id: string, item: string, model?: string) => {
    const label = model ? `${item} (${model})` : item;
    if (window.confirm(`Are you sure you want to remove "${label}" from inventory?`)) {
      deleteStockMutation.mutate(id);
    }
  };

  const onSubmit = (data: StockFormValues) => {
    addStockMutation.mutate(data);
  };

  const filteredStocks = stocks.filter((s) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      s.item?.toLowerCase().includes(term) ||
      s.buyed_from?.toLowerCase().includes(term) ||
      s.supported_model?.toLowerCase().includes(term) ||
      s.box_no?.toLowerCase().includes(term)
    );
  });

  // Calculate stock inventory stats
  const totalUnits = stocks.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
  const lowStockCount = stocks.filter(s => Number(s.quantity) <= 1).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
              Spare Parts & Inventory Management
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track hardware spares, vendors, supported mobile models, and storage bin locations.
          </p>
        </div>

        {/* Quick Inventory Health Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/80 shadow-xs text-xs font-semibold">
            <Boxes className="w-4 h-4 text-primary" />
            <span>Total Units:</span>
            <span className="font-mono font-bold text-foreground">{totalUnits}</span>
          </div>

          {lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Low Stock:</span>
              <span className="font-mono font-bold">{lowStockCount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD STOCK FORM CARD */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="cockpit-card rounded-2xl overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center gap-2">
              <PlusCircle className="w-4 h-4 text-primary" />
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                Add Inventory Item
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Part Type Selection */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5 text-foreground">
                    Spare Part Category <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PART_TYPES.map((part) => {
                      const isSelected = watch("item") === part;
                      return (
                        <button
                          key={part}
                          type="button"
                          onClick={() => setValue("item", part, { shouldValidate: true })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                              : "bg-muted/50 border border-border/60 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {part}
                        </button>
                      );
                    })}
                  </div>
                  <input type="hidden" {...register("item", { required: "Item name is required" })} />
                  {errors.item && <p className="text-[10px] text-rose-500 mt-1">{errors.item.message}</p>}
                </div>

                {/* Supplier Selection */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5 text-foreground">
                    Purchased From (Vendor)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SUPPLIERS.map((sup) => {
                      const isSelected = watch("buyed_from") === sup;
                      return (
                        <button
                          key={sup}
                          type="button"
                          onClick={() => setValue("buyed_from", sup)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-muted/40 border border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {sup}
                        </button>
                      );
                    })}
                  </div>
                  <input type="hidden" {...register("buyed_from")} />
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-xs font-semibold block mb-1 text-foreground">
                    Quantity <span className="text-rose-500">*</span>
                  </label>
                  <Input 
                    type="number" 
                    {...register("quantity", { required: "Quantity is required", min: 1 })} 
                    placeholder="1" 
                    className="h-10 text-xs font-mono font-bold rounded-xl" 
                  />
                  {errors.quantity && <p className="text-[10px] text-rose-500 mt-1">{errors.quantity.message}</p>}
                </div>

                {/* Supported Model */}
                <div>
                  <label className="text-xs font-semibold block mb-1 text-foreground">Compatible Device Model</label>
                  <Input 
                    {...register("supported_model")} 
                    placeholder="e.g. iPhone 13, Galaxy S21" 
                    className="h-10 text-xs rounded-xl font-medium" 
                  />
                </div>

                {/* Box / Bin Location */}
                <div>
                  <label className="text-xs font-semibold block mb-1 text-foreground">Storage Box / Bin #</label>
                  <Input 
                    {...register("box_no")} 
                    placeholder="e.g. Box A-3, Shelf 2" 
                    className="h-10 text-xs rounded-xl font-mono" 
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={addStockMutation.isPending}
                  className="w-full h-11 text-xs font-bold uppercase tracking-wider rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20"
                >
                  Save to Inventory
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* INVENTORY DATA TABLE */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="cockpit-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Stock Catalog ({filteredStocks.length} Items)
              </span>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search item, vendor, model..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs rounded-xl bg-background"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-b border-border/80 hover:bg-transparent">
                    <TableHead className="text-xs font-bold uppercase py-3.5">Item Name</TableHead>
                    <TableHead className="text-xs font-bold uppercase py-3.5">Vendor / Source</TableHead>
                    <TableHead className="text-xs font-bold uppercase py-3.5">Supported Device</TableHead>
                    <TableHead className="text-xs font-bold uppercase py-3.5 text-center">Bin / Box</TableHead>
                    <TableHead className="text-xs font-bold uppercase py-3.5 text-center">In Stock</TableHead>
                    <TableHead className="text-xs font-bold uppercase py-3.5 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell colSpan={6} className="py-4">
                          <div className="h-6 rounded bg-muted/60 animate-pulse" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredStocks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                        No inventory matches found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStocks.map((s) => {
                      const qty = Number(s.quantity);
                      return (
                        <TableRow key={s.id} className="border-b border-border/40 hover:bg-muted/30 text-xs">
                          <TableCell className="font-bold text-foreground flex items-center gap-2 py-3.5">
                            <Box className="w-3.5 h-3.5 text-primary" />
                            <span>{s.item}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 bg-muted/60 text-muted-foreground">
                              {s.buyed_from || "Local"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {s.supported_model || "-"}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {s.box_no || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`font-mono text-xs font-bold px-2 py-0.5 ${
                                qty <= 0
                                  ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                  : qty <= 2
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              }`}
                            >
                              {qty}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingItem({ ...s })}
                                className="h-7 w-7 text-muted-foreground hover:text-primary rounded-lg"
                                title="Edit Stock Item"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(s.id, s.item, s.supported_model)}
                                className="h-7 w-7 text-muted-foreground hover:text-rose-500 rounded-lg"
                                title="Delete Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Stock Item Modal Dialog */}
      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                <Edit className="w-4 h-4 text-primary" /> Update Stock Item
              </DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingItem) {
                  updateStockMutation.mutate(editingItem);
                }
              }}
              className="space-y-4 pt-2"
            >
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Part Type
                </label>
                <select
                  value={editingItem.item}
                  onChange={(e) => setEditingItem({ ...editingItem, item: e.target.value })}
                  className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-input bg-background"
                >
                  {PART_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Supplier / Source
                </label>
                <select
                  value={editingItem.buyed_from}
                  onChange={(e) => setEditingItem({ ...editingItem, buyed_from: e.target.value })}
                  className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-input bg-background"
                >
                  {SUPPLIERS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Supported Model
                </label>
                <Input
                  value={editingItem.supported_model || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, supported_model: e.target.value })}
                  placeholder="e.g. Redmi Note 10 Pro, iPhone 11"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Box / Bin No
                  </label>
                  <Input
                    value={editingItem.box_no || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, box_no: e.target.value })}
                    placeholder="e.g. B-04"
                    className="h-10 text-xs font-mono rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Units in Stock
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-xl"
                      onClick={() => setEditingItem({ ...editingItem, quantity: Math.max(0, Number(editingItem.quantity) - 1) })}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      value={editingItem.quantity}
                      onChange={(e) => setEditingItem({ ...editingItem, quantity: Math.max(0, Number(e.target.value)) })}
                      className="h-10 text-xs font-mono font-bold text-center rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-xl"
                      onClick={() => setEditingItem({ ...editingItem, quantity: Number(editingItem.quantity) + 1 })}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-3 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingItem(null)}
                  className="h-10 text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateStockMutation.isPending}
                  className="h-10 px-5 text-xs font-bold gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                >
                  {updateStockMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
