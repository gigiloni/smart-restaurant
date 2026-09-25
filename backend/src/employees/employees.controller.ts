import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  createEmployeeSchema,
  employeeAccountSchema,
  employeeSchema,
  idParamSchema,
  updateEmployeeSchema,
  type CreateEmployeeDto,
  type EmployeeAccountDto,
  type UpdateEmployeeDto,
} from '@smart-restaurant/contracts';

import { AccessService } from '../auth/access.service.js';
import { CurrentEmployee } from '../auth/current-employee.decorator.js';
import type { AuthenticatedEmployee } from '../auth/auth.types.js';
import {
  ApiEntityConflictResponse,
  ApiEntityNotFoundResponse,
  ApiIdParam,
  ApiValidationErrorResponse,
} from '../swagger/api-docs.decorators.js';
import { EmployeesService } from './employees.service.js';

@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all employees',
    description:
      'Returns every member of staff, sorted by family name then given name. Takes no query parameters: the list is neither filtered nor paginated.',
  })
  @ApiOkResponse({
    description: 'All employees, sorted by name.',
    standardSchema: employeeSchema,
    isArray: true,
  })
  findAll(@CurrentEmployee() actor: AuthenticatedEmployee) {
    this.access.requireAdmin(actor);
    return this.employeesService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the signed-in employee profile' })
  @ApiOkResponse({ description: 'The current employee.', standardSchema: employeeSchema })
  me(@CurrentEmployee() actor: AuthenticatedEmployee) {
    return this.employeesService.findOne(actor.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one employee', description: 'Returns a single member of staff.' })
  @ApiIdParam('id', 'Id of the employee to return.')
  @ApiOkResponse({ description: 'The requested employee.', standardSchema: employeeSchema })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No employee with that id exists.')
  findOne(
    @Param('id', { schema: idParamSchema }) id: number,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireEmployee(actor, id);
    return this.employeesService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Add an employee',
    description:
      'Adds a member of staff, who can then be assigned to the orders they take through `employeeId`. Names are not required to be unique.',
  })
  @ApiCreatedResponse({ description: 'The created employee.', standardSchema: employeeSchema })
  @ApiValidationErrorResponse('The payload failed validation.')
  create(
    @Body({ schema: createEmployeeSchema }) dto: CreateEmployeeDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireAdmin(actor);
    return this.employeesService.create(dto);
  }

  @Post(':id/account')
  @ApiOperation({ summary: 'Add login credentials to an existing employee' })
  @ApiIdParam('id', 'Id of the employee to activate.')
  @ApiCreatedResponse({ description: 'The activated employee.', standardSchema: employeeSchema })
  provisionAccount(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: employeeAccountSchema }) dto: EmployeeAccountDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireAdmin(actor);
    return this.employeesService.provisionAccount(id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an employee',
    description:
      'Updates the fields present in the payload. At least one field is required.\n\n' +
      '**Side effects:** orders hold a reference rather than a copy, so a renamed or reassigned employee reads back that way on every order they have already taken, not just future ones.',
  })
  @ApiIdParam('id', 'Id of the employee to update.')
  @ApiOkResponse({ description: 'The updated employee.', standardSchema: employeeSchema })
  @ApiValidationErrorResponse('`id` is not a positive integer, or the payload is empty or invalid.')
  @ApiEntityNotFoundResponse('No employee with that id exists.')
  update(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateEmployeeSchema }) dto: UpdateEmployeeDto,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireEmployeeUpdate(actor, id, dto.role);
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an employee',
    description:
      'Removes a member of staff.\n\n' +
      'An employee who has taken any order is not deletable — orders record who took them, and nothing is cascaded away here. Unassign the orders first, or leave the employee in place.',
  })
  @ApiIdParam('id', 'Id of the employee to delete.')
  @ApiOkResponse({
    description: 'The deleted employee, as they were immediately before deletion.',
    standardSchema: employeeSchema,
  })
  @ApiValidationErrorResponse('`id` is not a positive integer.')
  @ApiEntityNotFoundResponse('No employee with that id exists.')
  @ApiEntityConflictResponse('The employee has taken at least one order.')
  remove(
    @Param('id', { schema: idParamSchema }) id: number,
    @CurrentEmployee() actor: AuthenticatedEmployee,
  ) {
    this.access.requireAdmin(actor);
    return this.employeesService.remove(id);
  }
}
