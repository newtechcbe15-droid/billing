import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDB, generateId } from "@/lib/localDB";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, PlusCircle, Trash2, Search } from "lucide-react";

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

export default function Stock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<StockFormValues>();

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
      toast({ title: "Stock Added", description: "The item has been added to the stock list." });
      reset();
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Operation Failed", description: err.message });
    }
  });

  const deleteStockMutation = useMutation({
    mutationFn: async (id: string) => {
      const currentStocks = await localDB.stock.getAll();
      const updated = currentStocks.filter((s: any) => s.id !== id);
      await localDB.stock.save(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      toast({ title: "Stock Removed", description: "The item has been removed from the stock list." });
    }
  });

  const onSubmit = (data: StockFormValues) => {
    addStockMutation.mutate(data);
  };

  const filteredStocks = stocks.filter((s) => {
    const term = search.toLowerCase();
    return (
      s.item?.toLowerCase().includes(term) ||
      s.buyed_from?.toLowerCase().includes(term) ||
      s.supported_model?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-16 relative z-10">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Stock Management</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Track and manage available inventory in your shop.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD STOCK FORM */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-blue-500" />
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Add New Stock</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Item Name*</label>
                  <div className="flex gap-2">
                    <Button type="button" variant={watch("item") === "Display" ? "default" : "outline"} onClick={() => setValue("item", "Display", { shouldValidate: true })} className={`flex-1 h-8 text-xs font-bold ${watch("item") === "Display" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}`}>Display</Button>
                    <Button type="button" variant={watch("item") === "CC" ? "default" : "outline"} onClick={() => setValue("item", "CC", { shouldValidate: true })} className={`flex-1 h-8 text-xs font-bold ${watch("item") === "CC" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}`}>CC</Button>
                    <Button type="button" variant={watch("item") === "Battery" ? "default" : "outline"} onClick={() => setValue("item", "Battery", { shouldValidate: true })} className={`flex-1 h-8 text-xs font-bold ${watch("item") === "Battery" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}`}>Battery</Button>
                  </div>
                  <input type="hidden" {...register("item", { required: "Item name is required" })} />
                  {errors.item && <p className="text-[10px] text-rose-500 mt-1">{errors.item.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Buyed From</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant={watch("buyed_from") === "Kaveri" ? "default" : "outline"} onClick={() => setValue("buyed_from", "Kaveri")} className={`h-8 text-xs font-bold ${watch("buyed_from") === "Kaveri" ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""}`}>Kaveri</Button>
                    <Button type="button" variant={watch("buyed_from") === "Surya" ? "default" : "outline"} onClick={() => setValue("buyed_from", "Surya")} className={`h-8 text-xs font-bold ${watch("buyed_from") === "Surya" ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""}`}>Surya</Button>
                    <Button type="button" variant={watch("buyed_from") === "Bangalore" ? "default" : "outline"} onClick={() => setValue("buyed_from", "Bangalore")} className={`h-8 text-xs font-bold ${watch("buyed_from") === "Bangalore" ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""}`}>Bangalore</Button>
                    <Button type="button" variant={watch("buyed_from") === "Cell Care" ? "default" : "outline"} onClick={() => setValue("buyed_from", "Cell Care")} className={`h-8 text-xs font-bold ${watch("buyed_from") === "Cell Care" ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""}`}>Cell Care</Button>
                  </div>
                  <input type="hidden" {...register("buyed_from")} />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Quantity*</label>
                  <Input type="number" {...register("quantity", { required: "Quantity is required", min: 1 })} placeholder="1" className="h-9 text-xs" />
                  {errors.quantity && <p className="text-[10px] text-rose-500 mt-1">{errors.quantity.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Supported Model</label>
                  <Input {...register("supported_model")} placeholder="e.g. iPhone 13, Samsung S21" className="h-9 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Box No</label>
                  <Input {...register("box_no")} placeholder="e.g. B-12" className="h-9 text-xs" />
                </div>
                
                <Button type="submit" disabled={addStockMutation.isPending} className="w-full h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white">
                  {addStockMutation.isPending ? "Saving..." : "Add to Stock"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* STOCK TABLE */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-500" />
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Available Stock</CardTitle>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search item, model, supplier..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-white dark:bg-zinc-900 border-border"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[60px] text-xs font-bold">S.No</TableHead>
                      <TableHead className="text-xs font-bold">Item</TableHead>
                      <TableHead className="text-xs font-bold">Buyed From</TableHead>
                      <TableHead className="text-xs font-bold text-center">Quantity</TableHead>
                      <TableHead className="text-xs font-bold">Supported Model</TableHead>
                      <TableHead className="text-xs font-bold">Box No</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                          Loading stock items...
                        </TableCell>
                      </TableRow>
                    ) : filteredStocks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                          No stock found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStocks.map((stock, idx) => (
                        <TableRow key={stock.id} className="group transition-colors hover:bg-muted/50">
                          <TableCell className="text-xs font-medium text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-bold">{stock.item}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{stock.buyed_from || "-"}</TableCell>
                          <TableCell className="text-xs font-bold text-center">
                            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded text-[10px]">
                              {stock.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{stock.supported_model || "-"}</TableCell>
                          <TableCell className="text-xs font-bold text-slate-700 dark:text-zinc-300">{stock.box_no || "-"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                if (window.confirm("Are you sure you want to remove this stock item?")) {
                                  deleteStockMutation.mutate(stock.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
