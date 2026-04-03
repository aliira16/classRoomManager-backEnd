import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { departments, subjects } from "../db/schema";
import { db } from "../db";

const router = express.Router();

// get all sebjects with optional search filtering and pqgination
router.get("/", async (req, res) => {
  try {
    const { search, department, page = 1, limit = 10 } = req.query;
    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitePerPage = Math.min(
      Math.max(1, parseInt(String(limit), 10) || 10),
      100,
    ); // max 100 items per page to prevent abuse

    const offset = (currentPage - 1) * limitePerPage;

    const filterConditions = [];

    // if search is provided, filter subjects by name or code
    if (search) {
      filterConditions.push(
        or(
          ilike(subjects.name, `%${search}%`),
          ilike(subjects.code, `%${search}%`),
        ),
      );
    }

    // if department is provided, filter subjects by department name
    if (department) {
      filterConditions.push(ilike(departments.name, `%${department}%`));
      const deptPattern = `%${String(department).replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      filterConditions.push(ilike(departments.name, deptPattern)); // escape % and _ for SQL LIKE
    }

    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count || 0;

    const subjectList = await db
      .select({
        ...getTableColumns(subjects),
        department: { ...getTableColumns(departments) },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(subjects.createdAt))
      .limit(limitePerPage)
      .offset(offset);

    res.status(200).json({
      data: subjectList,
      pagination: {
        page: currentPage,
        limit: limitePerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitePerPage),
      },
    });
  } catch (e) {
    console.error(`Get /subjects error: ${e}`);
    res.status(500).json({ error: "faild to get subjects" });
  }
});

export default router;
