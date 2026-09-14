import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDB, generateId } from "@/lib/localDB";
import { useStaffRoster } from "@/lib/staffRoster";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV } from "@/lib/utils";
import { Link } from "react-router-dom";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CalendarCheck,
  Calendar,
  CheckCircle2,
  Clock,
  UserX,
  Palmtree,
  Users,
  Search,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  UserCog,
  Pencil,
  Trash2,
  RotateCcw,
  UserPlus
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

export type AttendanceStatus = "Present" | "Half Day" | "Absent" | "On Leave";

export interface AttendanceRecord {
  id: string;
  staff_name: string;
  date: string;
  status: AttendanceStatus;
  check_in_time?: string;
  check_out_time?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export default function Attendance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Centralized Staff Roster
  const { staffList, addStaff, updateStaff, removeStaff, resetToDefaults } = useStaffRoster();

  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonthStr = todayStr.substring(0, 7);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [activeTab, setActiveTab] = useState<"daily" | "monthly">("daily");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modals state
  const [isManageRosterModalOpen, setIsManageRosterModalOpen] = useState(false);
  const [newStaffInput, setNewStaffInput] = useState("");
  const [renameModalData, setRenameModalData] = useState<{ isOpen: boolean; oldName: string; newName: string }>({
    isOpen: false,
    oldName: "",
    newName: ""
  });

  // 1. Fetch Attendance Records
  const { data: attendanceList = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["allAttendance"],
    queryFn: async () => await localDB.attendance.getAll()
  });

  // Date Navigators
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  // Records for the currently selected day
  const dailyRecordsMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceList
      .filter((r) => r.date === selectedDate)
      .forEach((r) => {
        map.set(r.staff_name.toLowerCase(), r);
      });
    return map;
  }, [attendanceList, selectedDate]);

  // Daily statistics based on active roster
  const dailyStats = useMemo(() => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let onLeave = 0;
    let unrecorded = 0;

    staffList.forEach((name) => {
      const rec = dailyRecordsMap.get(name.toLowerCase());
      if (!rec) {
        unrecorded++;
      } else if (rec.status === "Present") {
        present++;
      } else if (rec.status === "Half Day") {
        halfDay++;
      } else if (rec.status === "Absent") {
        absent++;
      } else if (rec.status === "On Leave") {
        onLeave++;
      }
    });

    const totalStaff = staffList.length;
    const recordedTotal = present + halfDay + absent + onLeave;
    const presentScore = present + halfDay * 0.5;
    const rate = totalStaff > 0 ? Math.round((presentScore / totalStaff) * 100) : 0;

    return {
      totalStaff,
      present,
      halfDay,
      absent,
      onLeave,
      unrecorded,
      recordedTotal,
      rate
    };
  }, [staffList, dailyRecordsMap]);

  // Save or update single staff attendance record
  const saveRecordMutation = useMutation({
    mutationFn: async ({
      staffName,
      status,
      checkIn,
      checkOut,
      notes
    }: {
      staffName: string;
      status: AttendanceStatus;
      checkIn?: string;
      checkOut?: string;
      notes?: string;
    }) => {
      const existing = dailyRecordsMap.get(staffName.toLowerCase());
      const now = new Date().toISOString();

      if (existing) {
        const updated: AttendanceRecord = {
          ...existing,
          status,
          check_in_time: checkIn !== undefined ? checkIn : existing.check_in_time,
          check_out_time: checkOut !== undefined ? checkOut : existing.check_out_time,
          notes: notes !== undefined ? notes : existing.notes,
          updated_at: now
        };
        await localDB.attendance.update(existing.id, updated);
        return updated;
      } else {
        const newRecord: AttendanceRecord = {
          id: generateId(),
          staff_name: staffName,
          date: selectedDate,
          status,
          check_in_time: checkIn || "09:30 AM",
          check_out_time: checkOut || "08:30 PM",
          notes: notes || "",
          created_at: now,
          updated_at: now
        };
        await localDB.attendance.insert(newRecord);
        return newRecord;
      }
    },
    onSuccess: (rec) => {
      queryClient.invalidateQueries({ queryKey: ["allAttendance"] });
      toast({
        title: "Attendance Updated",
        description: `${rec.staff_name} marked as ${rec.status} on ${selectedDate}.`
      });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Save Error", description: err.message });
    }
  });

  // Bulk mark all staff as Present for the selected date
  const markAllPresentMutation = useMutation({
    mutationFn: async () => {
      const allCurrent = await localDB.attendance.getAll();
      const now = new Date().toISOString();
      const updatedList = [...allCurrent];

      staffList.forEach((name) => {
        const existingIdx = updatedList.findIndex(
          (r: any) => r.staff_name.toLowerCase() === name.toLowerCase() && r.date === selectedDate
        );
        if (existingIdx > -1) {
          updatedList[existingIdx] = {
            ...updatedList[existingIdx],
            status: "Present",
            check_in_time: updatedList[existingIdx].check_in_time || "09:30 AM",
            check_out_time: updatedList[existingIdx].check_out_time || "08:30 PM",
            updated_at: now
          };
        } else {
          updatedList.push({
            id: generateId(),
            staff_name: name,
            date: selectedDate,
            status: "Present",
            check_in_time: "09:30 AM",
            check_out_time: "08:30 PM",
            notes: "Quick Bulk Check-in",
            created_at: now,
            updated_at: now
          });
        }
      });

      await localDB.attendance.save(updatedList);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allAttendance"] });
      toast({
        title: "All Staff Marked Present",
        description: `Logged 100% full-day presence for ${staffList.length} staff members on ${selectedDate}.`
      });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Bulk Action Error", description: err.message });
    }
  });

  // Handle Adding a Staff Member
  const handleAddStaffSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newStaffInput.trim();
    if (!trimmed) return;

    const success = addStaff(trimmed);
    if (!success) {
      toast({
        variant: "destructive",
        title: "Cannot Add Staff",
        description: `"${trimmed}" already exists in the roster.`
      });
      return;
    }

    setNewStaffInput("");
    toast({
      title: "Staff Added",
      description: `"${trimmed}" is now active in the staff roster across NTCS ERP.`
    });
  };

  // Open Rename Dialog
  const handleOpenRename = (staffName: string) => {
    setRenameModalData({
      isOpen: true,
      oldName: staffName,
      newName: staffName
    });
  };

  // Execute Staff Rename
  const handleExecuteRename = async () => {
    const { oldName, newName } = renameModalData;
    const trimmedNew = newName.trim();
    if (!trimmedNew || trimmedNew.toLowerCase() === oldName.toLowerCase()) {
      setRenameModalData({ isOpen: false, oldName: "", newName: "" });
      return;
    }

    const success = updateStaff(oldName, trimmedNew);
    if (!success) {
      toast({
        variant: "destructive",
        title: "Rename Failed",
        description: `A staff member named "${trimmedNew}" already exists.`
      });
      return;
    }

    // Also migrate past attendance records from oldName to newName
    try {
      const allCurrent = await localDB.attendance.getAll();
      let hasChanges = false;
      const updated = allCurrent.map((r: any) => {
        if (r.staff_name && r.staff_name.toLowerCase() === oldName.toLowerCase()) {
          hasChanges = true;
          return { ...r, staff_name: trimmedNew, updated_at: new Date().toISOString() };
        }
        return r;
      });

      if (hasChanges) {
        await localDB.attendance.save(updated);
        queryClient.invalidateQueries({ queryKey: ["allAttendance"] });
      }
    } catch (e) {
      console.warn("Could not batch-update past attendance records:", e);
    }

    setRenameModalData({ isOpen: false, oldName: "", newName: "" });
    toast({
      title: "Staff Renamed",
      description: `Updated "${oldName}" to "${trimmedNew}" across Attendance, Salary, and ERP modules.`
    });
  };

  // Handle Removing Staff
  const handleRemoveStaff = (staffName: string) => {
    if (staffList.length <= 1) {
      toast({
        variant: "destructive",
        title: "Action Not Allowed",
        description: "You must have at least one active staff member."
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove "${staffName}" from the active staff roster?\n\n` +
      `• They will no longer appear on daily attendance mark sheets or new salary forms.\n` +
      `• Past completed jobs, delivery records, and historical payroll vouchers will remain safe in reports.`
    );

    if (confirmed) {
      const success = removeStaff(staffName);
      if (success) {
        toast({
          title: "Staff Member Removed",
          description: `"${staffName}" was removed from the active staff roster.`
        });
      }
    }
  };

  // Handle Reset Roster to Defaults
  const handleResetRoster = () => {
    const confirmed = window.confirm(
      "Reset staff roster to default 7 technicians (Suresh, Sajith, Karthik Raj, Karthi, Sanjay, Anandhan, Karthikeyan)?"
    );
    if (confirmed) {
      resetToDefaults();
      toast({
        title: "Roster Reset",
        description: "Staff roster restored to default 7 technicians."
      });
    }
  };

  // Monthly aggregated attendance calculations
  const monthlySummary = useMemo(() => {
    const monthRecords = attendanceList.filter((r) => r.date && r.date.startsWith(selectedMonth));
    const staffMap: Record<
      string,
      {
        name: string;
        present: number;
        halfDay: number;
        absent: number;
        onLeave: number;
        totalDaysLogged: number;
      }
    > = {};

    staffList.forEach((name) => {
      staffMap[name] = {
        name,
        present: 0,
        halfDay: 0,
        absent: 0,
        onLeave: 0,
        totalDaysLogged: 0
      };
    });

    monthRecords.forEach((r) => {
      const name = r.staff_name;
      if (!staffMap[name]) {
        staffMap[name] = {
          name,
          present: 0,
          halfDay: 0,
          absent: 0,
          onLeave: 0,
          totalDaysLogged: 0
        };
      }
      staffMap[name].totalDaysLogged += 1;
      if (r.status === "Present") staffMap[name].present += 1;
      else if (r.status === "Half Day") staffMap[name].halfDay += 1;
      else if (r.status === "Absent") staffMap[name].absent += 1;
      else if (r.status === "On Leave") staffMap[name].onLeave += 1;
    });

    const [year, month] = selectedMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const list = Object.values(staffMap).map((s) => {
      const payableDays = s.present + s.halfDay * 0.5;
      const rate = s.totalDaysLogged > 0 ? Math.round((payableDays / s.totalDaysLogged) * 100) : 0;
      return {
        ...s,
        payableDays,
        daysInMonth,
        attendanceRate: rate
      };
    });

    list.sort((a, b) => b.payableDays - a.payableDays);

    let totalMonthPresent = 0;
    let totalMonthHalfDay = 0;
    let totalMonthAbsent = 0;
    let totalMonthLeave = 0;
    list.forEach((s) => {
      totalMonthPresent += s.present;
      totalMonthHalfDay += s.halfDay;
      totalMonthAbsent += s.absent;
      totalMonthLeave += s.onLeave;
    });

    return {
      list,
      totalMonthPresent,
      totalMonthHalfDay,
      totalMonthAbsent,
      totalMonthLeave,
      daysInMonth
    };
  }, [attendanceList, selectedMonth, staffList]);

  // Export monthly attendance to CSV
  const handleExportCSV = () => {
    const formatted = monthlySummary.list.map((s, idx) => ({
      "#": idx + 1,
      "Staff Member": s.name,
      "Month": selectedMonth,
      "Present Days": s.present,
      "Half Days": s.halfDay,
      "Absent Days": s.absent,
      "Approved Leaves": s.onLeave,
      "Total Logged Days": s.totalDaysLogged,
      "Payable Days": s.payableDays,
      "Attendance Score (%)": `${s.attendanceRate}%`
    }));
    exportToCSV(formatted, `NTCS_Staff_Attendance_${selectedMonth}`);
  };

  // Filter staff by search term
  const filteredStaffNames = useMemo(() => {
    if (!searchTerm.trim()) return staffList;
    const q = searchTerm.toLowerCase().trim();
    return staffList.filter((name) => name.toLowerCase().includes(q));
  }, [staffList, searchTerm]);

  return (
    <div className="space-y-6 max-w-[1300px] mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground">
              Staff Attendance & Daily Log
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Log technician daily check-ins, leaves, half-days, and monitor monthly payable days for payroll.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick link to Salary */}
          <Link to="/salary">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold rounded-xl flex items-center gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Users className="w-3.5 h-3.5" />
              Staff Salary & Payroll →
            </Button>
          </Link>

          {/* Manage Staff Roster Modal Trigger */}
          <Button
            size="sm"
            onClick={() => setIsManageRosterModalOpen(true)}
            className="h-8 text-xs font-bold rounded-xl gap-1.5 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <UserCog className="w-3.5 h-3.5" />
            Manage Staff ({staffList.length})
          </Button>
        </div>
      </div>

      {/* Date & Filter Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-muted/20 border border-border/60">
        {/* Left: View Tabs */}
        <div className="flex items-center gap-1.5">
          <Button
            variant={activeTab === "daily" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("daily")}
            className="h-8 text-xs font-bold rounded-xl gap-1.5"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            Daily Mark Sheet
          </Button>

          <Button
            variant={activeTab === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("monthly")}
            className="h-8 text-xs font-bold rounded-xl gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            Monthly Summary Sheet
          </Button>
        </div>

        {/* Right: Date or Month Controls */}
        {activeTab === "daily" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevDay}
              className="h-8 px-2 rounded-xl"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-1.5 bg-background border border-border/80 px-2.5 py-1 rounded-xl shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-6 w-32 border-0 bg-transparent text-xs font-mono font-bold p-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextDay}
              className="h-8 px-2 rounded-xl"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button
              variant={selectedDate === todayStr ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDate(todayStr)}
              className="h-8 text-xs font-bold rounded-xl"
            >
              Today
            </Button>

            {/* Quick 1-Click Bulk Action */}
            <Button
              size="sm"
              disabled={markAllPresentMutation.isPending}
              onClick={() => markAllPresentMutation.mutate()}
              className="h-8 text-xs font-bold rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Mark All Present
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-background border border-border/80 px-2.5 py-1 rounded-xl shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-6 w-32 border-0 bg-transparent text-xs font-bold p-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs font-bold rounded-xl gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>
        )}
      </div>

      {/* KPI Metric Strip */}
      {activeTab === "daily" ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="cockpit-card rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Total Roster
            </span>
            <div className="text-xl font-black font-mono text-foreground flex items-baseline gap-1.5">
              <span>{dailyStats.totalStaff}</span>
              <span className="text-[11px] font-normal text-muted-foreground">technicians</span>
            </div>
          </Card>

          <Card className="cockpit-card rounded-2xl p-3.5 space-y-1 border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Present
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {dailyStats.present}
            </div>
          </Card>

          <Card className="cockpit-card rounded-2xl p-3.5 space-y-1 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Half Day
              </span>
              <Clock className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
              {dailyStats.halfDay}
            </div>
          </Card>

          <Card className="cockpit-card rounded-2xl p-3.5 space-y-1 border-rose-500/30 bg-rose-500/5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Absent
              </span>
              <UserX className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
              {dailyStats.absent}
            </div>
          </Card>

          <Card className="cockpit-card rounded-2xl p-3.5 space-y-1 border-blue-500/30 bg-blue-500/5 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                On Leave
              </span>
              <Palmtree className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
              {dailyStats.onLeave}
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="cockpit-card rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Month Period
            </span>
            <div className="text-xl font-black font-mono text-foreground">
              {new Date(selectedMonth + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </div>
            <span className="text-[10px] text-muted-foreground">{monthlySummary.daysInMonth} calendar days</span>
          </Card>

          <Card className="cockpit-card rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Full Days Present
            </span>
            <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {monthlySummary.totalMonthPresent} <span className="text-xs font-normal text-muted-foreground">days</span>
            </div>
          </Card>

          <Card className="cockpit-card rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
              Half Days Logged
            </span>
            <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
              {monthlySummary.totalMonthHalfDay} <span className="text-xs font-normal text-muted-foreground">days</span>
            </div>
          </Card>

          <Card className="cockpit-card rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
              Absences & Leaves
            </span>
            <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
              {monthlySummary.totalMonthAbsent + monthlySummary.totalMonthLeave}{" "}
              <span className="text-xs font-normal text-muted-foreground">days</span>
            </div>
          </Card>
        </div>
      )}

      {/* Main Content View */}
      {activeTab === "daily" ? (
        /* =================================================================== */
        /* TAB 1: DAILY MARK SHEET */
        /* =================================================================== */
        <Card className="cockpit-card rounded-2xl overflow-hidden shadow-lg border-border/70 animate-fadeIn">
          <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Daily Attendance Roster — {selectedDate}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {dailyStats.recordedTotal} / {dailyStats.totalStaff} Logged
              </Badge>
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search staff name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs rounded-xl bg-background"
              />
            </div>
          </div>

          <CardContent className="p-4 space-y-3">
            {filteredStaffNames.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-xs text-muted-foreground">No staff members match the filter.</p>
                <Button size="sm" onClick={() => setIsManageRosterModalOpen(true)} className="rounded-xl text-xs">
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Staff Member
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {filteredStaffNames.map((name, idx) => {
                  const record = dailyRecordsMap.get(name.toLowerCase());
                  const currentStatus = record?.status;

                  return (
                    <div
                      key={name}
                      className="p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3"
                    >
                      {/* Staff Profile with Inline Quick Edit & Remove */}
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-xs flex items-center justify-center font-mono border border-primary/20 shrink-0">
                          {idx + 1}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{name}</span>
                            {currentStatus && (
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-mono font-bold uppercase ${
                                  currentStatus === "Present"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                    : currentStatus === "Half Day"
                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                    : currentStatus === "Absent"
                                    ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                                    : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                }`}
                              >
                                {currentStatus}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>Technician</span>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => handleOpenRename(name)}
                              className="text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                              title={`Rename ${name}`}
                            >
                              <Pencil className="w-2.5 h-2.5" /> Rename
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveStaff(name)}
                              className="text-rose-500 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                              title={`Remove ${name} from roster`}
                            >
                              <Trash2 className="w-2.5 h-2.5" /> Remove
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 4 Status Toggle Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
                        <button
                          type="button"
                          onClick={() =>
                            saveRecordMutation.mutate({
                              staffName: name,
                              status: "Present",
                              checkIn: record?.check_in_time || "09:30 AM",
                              checkOut: record?.check_out_time || "08:30 PM",
                              notes: record?.notes || ""
                            })
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            currentStatus === "Present"
                              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 scale-102"
                              : "bg-background border border-border/80 text-muted-foreground hover:text-emerald-600 hover:border-emerald-500/40"
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Present
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            saveRecordMutation.mutate({
                              staffName: name,
                              status: "Half Day",
                              checkIn: record?.check_in_time || "09:30 AM",
                              checkOut: record?.check_out_time || "02:00 PM",
                              notes: record?.notes || "Half Day"
                            })
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            currentStatus === "Half Day"
                              ? "bg-amber-600 text-white shadow-sm shadow-amber-500/30 scale-102"
                              : "bg-background border border-border/80 text-muted-foreground hover:text-amber-600 hover:border-amber-500/40"
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Half Day
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            saveRecordMutation.mutate({
                              staffName: name,
                              status: "Absent",
                              checkIn: "-",
                              checkOut: "-",
                              notes: record?.notes || "Unexcused Absence"
                            })
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            currentStatus === "Absent"
                              ? "bg-rose-600 text-white shadow-sm shadow-rose-500/30 scale-102"
                              : "bg-background border border-border/80 text-muted-foreground hover:text-rose-600 hover:border-rose-500/40"
                          }`}
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Absent
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            saveRecordMutation.mutate({
                              staffName: name,
                              status: "On Leave",
                              checkIn: "-",
                              checkOut: "-",
                              notes: record?.notes || "Approved Leave"
                            })
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            currentStatus === "On Leave"
                              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30 scale-102"
                              : "bg-background border border-border/80 text-muted-foreground hover:text-blue-600 hover:border-blue-500/40"
                          }`}
                        >
                          <Palmtree className="w-3.5 h-3.5" />
                          On Leave
                        </button>
                      </div>

                      {/* Time & Remarks Quick Inputs */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
                        <Input
                          type="text"
                          placeholder="In: 09:30 AM"
                          value={record?.check_in_time || ""}
                          onChange={(e) => {
                            if (currentStatus) {
                              saveRecordMutation.mutate({
                                staffName: name,
                                status: currentStatus,
                                checkIn: e.target.value
                              });
                            }
                          }}
                          className="h-7 w-24 text-[11px] font-mono rounded-lg bg-background px-2"
                        />

                        <Input
                          type="text"
                          placeholder="Out: 08:30 PM"
                          value={record?.check_out_time || ""}
                          onChange={(e) => {
                            if (currentStatus) {
                              saveRecordMutation.mutate({
                                staffName: name,
                                status: currentStatus,
                                checkOut: e.target.value
                              });
                            }
                          }}
                          className="h-7 w-24 text-[11px] font-mono rounded-lg bg-background px-2"
                        />

                        <Input
                          type="text"
                          placeholder="Remarks / Notes..."
                          value={record?.notes || ""}
                          onChange={(e) => {
                            if (currentStatus) {
                              saveRecordMutation.mutate({
                                staffName: name,
                                status: currentStatus,
                                notes: e.target.value
                              });
                            }
                          }}
                          className="h-7 w-36 sm:w-44 text-[11px] rounded-lg bg-background px-2"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* =================================================================== */
        /* TAB 2: MONTHLY ATTENDANCE SUMMARY */
        /* =================================================================== */
        <Card className="cockpit-card rounded-2xl overflow-hidden shadow-lg border-border/70 animate-fadeIn">
          <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-500" />
                Monthly Attendance & Payable Days Summary ({selectedMonth})
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Aggregated technician attendance and calculation of billable payroll days (Present + 0.5 × Half Day).
              </p>
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs rounded-xl bg-background"
              />
            </div>
          </div>

          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/60 hover:bg-transparent text-[11px] font-bold uppercase text-muted-foreground bg-muted/10">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead className="text-center">Present (1.0)</TableHead>
                  <TableHead className="text-center">Half Day (0.5)</TableHead>
                  <TableHead className="text-center">Absent (0.0)</TableHead>
                  <TableHead className="text-center">On Leave</TableHead>
                  <TableHead className="text-center">Total Logged</TableHead>
                  <TableHead className="text-center">Attendance %</TableHead>
                  <TableHead className="text-right">Payable Days</TableHead>
                  <TableHead className="text-center w-28">Payroll Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlySummary.list.filter((s) => !searchTerm.trim() || s.name.toLowerCase().includes(searchTerm.toLowerCase().trim())).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground text-xs">
                      No attendance records found for {selectedMonth}.
                    </TableCell>
                  </TableRow>
                ) : (
                  monthlySummary.list
                    .filter((s) => !searchTerm.trim() || s.name.toLowerCase().includes(searchTerm.toLowerCase().trim()))
                    .map((st, idx) => (
                      <TableRow key={st.name} className="border-b border-border/40 hover:bg-muted/30 text-xs">
                        <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <span className="font-bold text-foreground">{st.name}</span>
                          <span className="text-[10px] text-muted-foreground block">Technician</span>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {st.present}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                          {st.halfDay}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                          {st.absent}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                          {st.onLeave}
                        </TableCell>
                        <TableCell className="text-center font-mono text-muted-foreground">
                          {st.totalDaysLogged} / {monthlySummary.daysInMonth}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1 w-20 mx-auto">
                            <span className="text-[10px] font-bold text-muted-foreground">{st.attendanceRate}%</span>
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  st.attendanceRate >= 90
                                    ? "bg-emerald-500"
                                    : st.attendanceRate >= 75
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${st.attendanceRate}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-black text-sm text-foreground">
                          {st.payableDays}{" "}
                          <span className="text-[10px] font-normal text-muted-foreground">days</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Link to="/salary">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] font-bold rounded-lg gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            >
                              Pay Salary <ArrowRight className="w-3 h-3" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: MANAGE STAFF ROSTER (ADD, RENAME, REMOVE, RESET) */}
      {/* =================================================================== */}
      <Dialog open={isManageRosterModalOpen} onOpenChange={setIsManageRosterModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <UserCog className="w-4 h-4 text-primary" />
              Manage Staff Roster ({staffList.length} Active Members)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Add New Staff Input Form */}
            <form onSubmit={handleAddStaffSubmit} className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Enter new technician / staff name..."
                value={newStaffInput}
                onChange={(e) => setNewStaffInput(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
              <Button type="submit" size="sm" className="h-9 font-bold text-xs rounded-xl gap-1 bg-primary shrink-0">
                <UserPlus className="w-3.5 h-3.5" />
                Add Staff
              </Button>
            </form>

            {/* List of Staff Members with Rename and Delete buttons */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {staffList.map((member, idx) => (
                <div
                  key={member}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/30 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-mono font-bold text-[11px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-foreground">{member}</p>
                      <p className="text-[10px] text-muted-foreground">Technician / Staff</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenRename(member)}
                      className="h-7 px-2 text-[11px] text-primary hover:bg-primary/10 rounded-lg gap-1 font-semibold"
                      title="Rename Staff Member"
                    >
                      <Pencil className="w-3 h-3" />
                      Rename
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveStaff(member)}
                      className="h-7 px-2 text-[11px] text-rose-500 hover:bg-rose-500/10 rounded-lg gap-1 font-semibold"
                      title="Remove from active roster"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Safety Reset to Factory Defaults */}
            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <span>Need to restore default technicians?</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetRoster}
                className="h-7 text-[10px] text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Defaults
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setIsManageRosterModalOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 2: RENAME STAFF MEMBER */}
      {/* =================================================================== */}
      <Dialog
        open={renameModalData.isOpen}
        onOpenChange={(open) => {
          if (!open) setRenameModalData({ isOpen: false, oldName: "", newName: "" });
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Rename Staff Member: {renameModalData.oldName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold block text-foreground">Updated Full Name</label>
            <Input
              type="text"
              value={renameModalData.newName}
              onChange={(e) =>
                setRenameModalData((prev) => ({ ...prev, newName: e.target.value }))
              }
              placeholder="Enter updated name..."
              className="h-10 text-xs rounded-xl"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Renaming will update this employee's name across Attendance, Salary, Job assignment, and historical records.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRenameModalData({ isOpen: false, oldName: "", newName: "" })}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteRename}
              className="rounded-xl font-bold text-xs bg-primary text-primary-foreground"
            >
              Save New Name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
