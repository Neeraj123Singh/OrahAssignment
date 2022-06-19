import { getRepository, In } from "typeorm"
import { NextFunction, Request, Response } from "express"
import { Group } from "../entity/group.entity"
import { StudentRollState } from "../entity/student-roll-state.entity";
import { GroupStudent } from "../entity/group-student.entity";
import { Student } from "../entity/student.entity";
import { Roll } from "../entity/roll.entity"
import { CreateGroupInput, UpdateGroupInput } from "../interface/group.interface"

export class GroupController {

  private groupRepository = getRepository(Group);
  private groupStudentRepository = getRepository(GroupStudent);
  private studentRollStateRepository = getRepository(StudentRollState);
  private rollRepository = getRepository(Roll);
  private studentRepository = getRepository(Student);
  private verifyInput = (input: { roll_states: string; ltmt: string; }) => {
    let lmtmArray = ['>', '<'];
    let rollStateArray = ["unmark", "present", "absent", "late"];
    let rollInputArray = input.roll_states.split(',');
    if (!lmtmArray.includes(input.ltmt)) return false;
    for (let i = 0; i < rollInputArray.length; i++) {
      if (!rollStateArray.includes(rollInputArray[i])) return false;
    }
    return true;
  }
  async allGroups(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    return await this.groupRepository.find();
    // Return the list of all groups
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    const { body: params } = request


    if (this.verifyInput(params) === false) return { error: "Invalid Arguments" };
    const createGroupInput: CreateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
      student_count: 0,
    }
    const group = new Group()
    group.prepareToCreate(createGroupInput)

    return this.groupRepository.save(group)
    // Add a Group
  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    const { body: params } = request

    this.groupRepository.findOne(params.id).then((group) => {
      const updateGroupInput: UpdateGroupInput = {
        id: params.id,
        name: params.name,
        number_of_weeks: params.number_of_weeks,
        roll_states: params.roll_states,
        incidents: params.incidents,
        ltmt: params.ltmt,
        student_count: 0
      }
      group.prepareToUpdate(updateGroupInput)

      return this.groupRepository.save(group)
    })
    // Update a Group
  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    // Task 1: 
    let groupToRemove = await this.groupRepository.findOne(request.params.id)
    await this.groupRepository.remove(groupToRemove)
    // Delete a Group
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    let { body: params } = request;
    if (!params.id) {
      return { error: "Please Provide the group ID" };
    }
    let groupStudents = await this.groupStudentRepository.find({ where: { group_id: params.id } });
    let studentsIds = [];
    for (let i = 0; i < groupStudents.length; i++) {
      studentsIds.push(groupStudents[i].student_id);
    }
    return await this.studentRepository.find({ id: In(studentsIds) })

  }


  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    // Task 2:
    // 1. Clear out the groups (delete all the students from the groups)
    let groupStudents = await this.groupStudentRepository.find();
    for (let i = 0; i < groupStudents.length; i++) {
      await this.groupStudentRepository.remove(groupStudents[i]);
    }
    groupStudents = await this.groupStudentRepository.find();

    let groups = await this.groupRepository.find();
    let rollStates = await this.studentRollStateRepository.find();
    for (let i = 0; i < groups.length; i++) {
      for (let j = 0; j < rollStates.length; j++) {
        let roll = await this.rollRepository.findOne({ id: rollStates[j].roll_id });
        if (groups[i].roll_states.split(',').includes(rollStates[j].state)) {
          if (groups[i].ltmt === '<') {
            let current = new Date();
            let currentDate = current.getTime();
            let rollDateFull = new Date(roll.completed_at)
            let rollDate = rollDateFull.getTime();
            if ((currentDate - rollDate) / (1000 * 3600 * 24) < groups[i].number_of_weeks * 7) {
              let groupStudent = await this.groupStudentRepository.findOne({ group_id: groups[i].id, student_id: rollStates[j].student_id });
              if (!groupStudent) groupStudent = await this.groupStudentRepository.save({ group_id: groups[i].id, student_id: rollStates[j].student_id, incident_count: 1 });
              else groupStudent = await this.groupStudentRepository.save({ id: groupStudent.id, group_id: groups[i].id, student_id: rollStates[j].student_id, incident_count: groupStudent.incident_count + 1 });
            }
          } else if (groups[i].ltmt === '>') {
            let current = new Date();
            let currentDate = current.getTime();
            let rollDateFull = new Date(roll.completed_at)
            let rollDate = rollDateFull.getTime();
            if ((currentDate - rollDate) / (1000 * 3600 * 24) > groups[i].number_of_weeks * 7) {
              let groupStudent = await this.groupStudentRepository.findOne({ group_id: groups[i].id, student_id: rollStates[j].student_id });
              if (!groupStudent) await this.groupStudentRepository.save({ group_id: groups[i].id, student_id: rollStates[j].student_id, incident_count: 1 });
              else await this.groupStudentRepository.save({ id: groupStudent.id, group_id: groups[i].id, student_id: rollStates[j].student_id, incident_count: groupStudent.incident_count + 1 });
            }
          }
        }
      }
      return true;
    }
  }
}
