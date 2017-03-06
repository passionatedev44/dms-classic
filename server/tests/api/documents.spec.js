
import request from 'supertest';
import chai from 'chai';
import app from '../../config/app';
import db from '../../app/models';
import helper from '../test.helper';

const superRequest = request.agent(app);
const expect = chai.expect;

const publicD = helper.publicDocument;
const privateD = helper.privateDocument;
const roleD = helper.roleDocument;

const compareDates = (firstDate, secondDate) =>
  new Date(firstDate).getTime() <= new Date(secondDate).getTime();

describe('DOCUMENT API', () => {
  let adminToken, regularToken, regularToken2;

  let regularUser, regularUser2;

  let createdDoc, roleDocument, publicDocument, privateDocument;

  let document, updateDoc;

  before((done) => {
    db.Role.bulkCreate([helper.testRoleA, helper.testRoleR])
      .then((roles) => {
        helper.adminUser.roleId = roles[0].id;
        db.User.create(helper.adminUser)
          .then(() => {
            superRequest.post('/users/login')
              .send(helper.adminUser)
              .end((err, res1) => {
                adminToken = res1.body.token;
                superRequest.post('/users')
                  .send(helper.regularUser)
                  .end((err, res2) => {
                    regularUser = res2.body.user;
                    regularToken = res2.body.token;
                    superRequest.post('/users')
                      .send(helper.regularUser2)
                      .end((err, res3) => {
                        regularUser2 = res3.body.user;
                        regularToken2 = res3.body.token;
                        done();
                      });
                  });
              });
          });
      });
  });

  after(() => {
    db.Role.destroy({ where: {} });
  });

  describe('CREATE DOCUMENT POST /documents', () => {
    it('should create a new document', (done) => {
      superRequest.post('/documents')
        .send(publicD)
        .set({ 'x-access-token': regularToken })
        .end((err, res) => {
          expect(res.status).to.equal(201);
          expect(res.body.document.title).to.equal(publicD.title);
          expect(res.body.document.ownerId).to.equal(regularUser.id);
          expect(res.body.document.access).to.equal(publicD.access);
          done();
        });
    });

    it('should return varification failed when token is not supplied',
    (done) => {
      superRequest.post('/documents')
        .send(publicD)
        .end((err, res) => {
          expect(res.status).to.equal(400);
          expect(res.body.success).to.equal(false);
          expect(res.body.message).to
            .equal('Please sign in or register to get a token');
          done();
        });
    });

    it('should not create document when title is not supplied', (done) => {
      const invalidDoc = { content: 'new document' };
      superRequest.post('/documents')
        .send(invalidDoc)
        .set({ 'x-access-token': adminToken })
        .end((err, res) => {
          expect(res.status).to.equal(400);
          expect(res.body.message).to.equal('Title field is required');
          done();
        });
    });

    it('should not create document when content is not supplied', (done) => {
      const invalidDoc = { title: 'new document' };
      superRequest.post('/documents')
        .send(invalidDoc)
        .set({ 'x-access-token': adminToken })
        .end((err, res) => {
          expect(res.status).to.equal(400);
          expect(res.body.message).to.equal('Content field is required');
          done();
        });
    });

    it('should not create document when an unknow access level is provided',
    (done) => {
      const invalidDoc =
      { title: 'hello', content: 'new Andela', access: 'new' };
      superRequest.post('/documents')
        .send(invalidDoc)
        .set({ 'x-access-token': adminToken })
        .end((err, res) => {
          expect(res.status).to.equal(400);
          expect(res.body.message).to
            .equal('Access type can only be public, private or role');
          done();
        });
    });
  });

  describe('Update Document /documents/:id', () => {
    before((done) => {
      superRequest.post('/documents')
        .send(publicD)
        .set({ 'x-access-token': regularToken })
        .end((err, res) => {
          createdDoc = res.body.document;
          done();
        });
    });

    it('should update document when user is the owner', (done) => {
      updateDoc = { title: 'andela' };
      superRequest.put(`/documents/${createdDoc.id}`)
        .send(updateDoc)
        .set({ 'x-access-token': regularToken })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body.updatedDocument.title).to.equal(updateDoc.title);
          expect(res.body.updatedDocument.content).to.equal(createdDoc.content);
          done();
        });
    });

    it('should allow admin to update document', (done) => {
      updateDoc = { title: 'TIA' };
      superRequest.put(`/documents/${createdDoc.id}`)
        .send(updateDoc)
        .set({ 'x-access-token': adminToken })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body.updatedDocument.title).to.equal(updateDoc.title);
          expect(res.body.updatedDocument.content).to.equal(createdDoc.content);
          done();
        });
    });

    it('should not update document when user is not the owner', (done) => {
      updateDoc = { content: 'new life, new culture, new community' };
      superRequest.put(`/documents/${createdDoc.id}`)
        .send(updateDoc)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.status).to.equal(401);
          expect(res.body.message)
            .to.equal('You are not permitted to modify this document');
          done();
        });
    });

    it('should not update document when token is not supply', (done) => {
      updateDoc = { content: 'new life, new culture, new community' };
      superRequest.put(`/documents/${createdDoc.id}`)
        .send(updateDoc)
        .end((err, res) => {
          expect(res.status).to.equal(400);
          expect(res.body.message).to
            .equal('Please sign in or register to get a token');
          done();
        });
    });

    it('should return not found when invalid id is supplied', (done) => {
      updateDoc = { content: 'new life, new culture, new community' };
      superRequest.put('/documents/9999')
        .send(updateDoc)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.status).to.equal(404);
          expect(res.body.message).to.equal('This document does not exist');
          done();
        });
    });
  });

  describe('Delete Document DELETE /documents/:id', () => {
    beforeEach((done) => {
      superRequest.post('/documents')
        .send(privateD)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          document = res.body.document;
          done();
        });
    });

    it('should allow document\'s owner to delete document', (done) => {
      superRequest.delete(`/documents/${document.id}`)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body.message)
            .to.equal('This document has been deleted successfully');
          done();
        });
    });

    it('should allow admin to delete any document', (done) => {
      superRequest.delete(`/documents/${document.id}`)
        .set({ 'x-access-token': adminToken })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body.message).to
            .equal('This document has been deleted successfully');
          done();
        });
    });

    it('should not delete document if requester is not the owner or admin',
    (done) => {
      superRequest.delete(`/documents/${document.id}`)
        .set({ 'x-access-token': regularToken })
        .end((err, res) => {
          expect(res.status).to.equal(401);
          expect(res.body.message).to
            .equal('You are not permitted to modify this document');
          done();
        });
    });

    it('should return not found when for invlid id', (done) => {
      superRequest.delete('/documents/999')
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.status).to.equal(404);
          expect(res.body.message).to.equal('This document does not exist');
          done();
        });
    });
  });

  describe('GET document /documents/:id', () => {
    describe('GET document with PRIVATE access', () => {
      before((done) => {
        superRequest.post('/documents')
          .send(privateD)
          .set({ 'x-access-token': regularToken })
          .end((err, res) => {
            privateDocument = res.body.document;
            done();
          });
      });

      it('should ONLY return the document when the user is the owner',
      (done) => {
        superRequest.get(`/documents/${privateDocument.id}`)
          .set({ 'x-access-token': regularToken })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.message).to
              .equal('You have successfully retrived this document');
            expect(res.body.document.title).to.equal(privateDocument.title);
            expect(res.body.document.access).to.equal('private');
            expect(res.body.document.ownerId).to.equal(regularUser.id);
            done();
          });
      });

      it('should allow admin to retrieve document with private access level',
      (done) => {
        superRequest.get(`/documents/${privateDocument.id}`)
          .set({ 'x-access-token': adminToken })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.message).to
              .equal('You have successfully retrived this document');
            expect(res.body.document.title).to.equal(privateDocument.title);
            expect(res.body.document.access).to.equal('private');
            done();
          });
      });

      it('should NOT return document when user is not the owner', (done) => {
        superRequest.get(`/documents/${privateDocument.id}`)
          .set({ 'x-access-token': regularToken2 })
          .end((err, res) => {
            expect(res.status).to.equal(401);
            expect(res.body.message).to
              .equal('You are not permitted to view this document');
            done();
          });
      });
    });

    describe('PUBLIC DOCUMENT', () => {
      before((done) => {
        superRequest.post('/documents')
          .send(publicD)
          .set({ 'x-access-token': regularToken2 })
          .end((err, res) => {
            publicDocument = res.body.document;
            done();
          });
      });

      it('should return document to all users', (done) => {
        superRequest.get(`/documents/${publicDocument.id}`)
          .set({ 'x-access-token': regularToken })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.document.title).to.equal(publicDocument.title);
            expect(res.body.document.access).to.equal('public');
            expect(res.body.message).to
              .equal('You have successfully retrived this document');
            done();
          });
      });

      it('should return document not found when invalid id is supplied',
      (done) => {
        superRequest.get('/documents/99999')
          .set({ 'x-access-token': regularToken })
          .end((err, res) => {
            expect(res.status).to.equal(404);
            expect(res.body.message).to.equal('This document cannot be found');
            done();
          });
      });
    });

    describe('ROLE ACCESS DOCUMENT', () => {
      let guestToken;
      before((done) => {
        db.Role.create(helper.testRoleG)
          .then((guestRole) => {
            helper.secondUser.roleId = guestRole.id;
            superRequest.post('/users')
              .send(helper.secondUser)
              .end((error, response) => {
                guestToken = response.body.token;
                superRequest.post('/documents')
                  .send(roleD)
                  .set({ 'x-access-token': regularToken })
                  .end((err, res) => {
                    roleDocument = res.body.document;
                    done();
                  });
              });
          });
      });

      it('should ONLY return document when user has same role as owner',
      (done) => {
        superRequest.get(`/documents/${roleDocument.id}`)
          .set({ 'x-access-token': regularToken2 })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.document.title).to.equal(roleDocument.title);
            expect(res.body.document.access).to.equal('role');
            expect(res.body.message).to
              .equal('You have successfully retrived this document');
            done();
          });
      });

      it('should allow admin to view all role level access documents',
      (done) => {
        superRequest.get(`/documents/${roleDocument.id}`)
          .set({ 'x-access-token': adminToken })
          .end((err, res) => {
            expect(res.status).to.equal(200);
            expect(res.body.document.title).to.equal(roleDocument.title);
            expect(res.body.document.access).to.equal('role');
            expect(res.body.message).to
              .equal('You have successfully retrived this document');
            done();
          });
      });

      it('should not return document if not of the same role level', (done) => {
        superRequest.get(`/documents/${roleDocument.id}`)
          .set({ 'x-access-token': guestToken })
          .end((err, res) => {
            expect(res.status).to.equal(401);
            expect(res.body.message).to
              .equal('You are not permitted to view this document');
            done();
          });
      });
    });
  });

  describe('GET ALL DOCUMENT PAGINATION', () => {
    it('should return all documents to admin user', (done) => {
      superRequest.get('/documents')
        .set({ 'x-access-token': adminToken })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body.message).to
            .equal('You have successfully retrieved all documents');
          expect(res.body.documents.count).to.be.greaterThan(0);
          res.body.documents.rows.forEach((doc) => {
            expect(doc.access).to.be.oneOf(['role', 'private', 'public']);
          });
          done();
        });
    });

    it('should return all documents with pagination', (done) => {
      superRequest.get('/documents?limit=4&offset=3')
        .set({ 'x-access-token': adminToken })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body.documents.count).to.be.greaterThan(0);
          expect(res.body.pagination.page_count).to.equal(2);
          expect(res.body.pagination.Page).to.equal(1);
          expect(res.body.pagination.page_size).to.equal('4');
          expect(res.body.pagination.total_count).to.equal(7);
          done();
        });
    });

    it(`should return all documents created by a user irrespective of the
    access level and every other documents with role or puclic access with
    limit set to 4`, (done) => {
      superRequest.get('/documents?limit=4')
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.body.documents.count).to.greaterThan(0);
          expect(res.status).to.equal(200);
          res.body.documents.rows.forEach((doc) => {
            if (doc.ownerId === regularUser2.id) {
              expect(doc.access).to.be.oneOf(['role', 'private', 'public']);
            } else {
              expect(doc.access).to.be.oneOf(['role', 'public']);
            }
          });
          done();
        });
    });

    it(`should return all documents in descending order of their respective
      published date`, (done) => {
      superRequest.get('/documents')
        .set({ 'x-access-token': adminToken })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          for (let i = 0; i < res.body.documents.rows.length - 1; i += 1) {
            const flag = compareDates(
              res.body.documents.rows[i].createdAt,
              res.body.documents.rows[1 + i].createdAt
            );
            expect(flag).to.equal(false);
          }
          done();
        });
    });
  });

  describe('DOCUMENT SEARCH PAGINATION', () => {
    it('should return search results', (done) => {
      superRequest.get(`/documents/search?query=
      ${publicD.content.substr(2, 6)}`)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          res.body.documents.rows.forEach((doc) => {
            if (doc.ownerId === regularUser2.id) {
              expect(doc.access).to.be.oneOf(['public', 'role', 'private']);
            } else { expect(doc.access).to.be.oneOf(['public', 'role']); }
          });
          expect(res.body.message).to.equal('This search was successfull');
          done();
        });
    });

    it('should return all search results to admin',
    (done) => {
      superRequest.get(`/documents/search?query=
      ${publicD.content.substr(2, 6)}`)
        .set({ 'x-access-token': adminToken })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          res.body.documents.rows.forEach((doc) => {
            expect(doc.access).to.be.oneOf(['public', 'role', 'private']);
          });
          done();
        });
    });

    it('should allow multiple search terms', (done) => {
      superRequest.get(`/documents/search?query=
      ${publicD.content.substr(2, 6)} ${publicD.title.substr(1, 6)}`)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          res.body.documents.rows.forEach((doc) => {
            if (doc.ownerId === regularUser2.id) {
              expect(doc.access).to.be.oneOf(['public', 'role', 'private']);
            } else { expect(doc.access).to.be.oneOf(['public', 'role']); }
          });
          done();
        });
    });

    it('should return all documents with pagination', (done) => {
      superRequest.get(`/documents/search?query=
      ${publicD.content.substr(2, 6)} ${publicD.title.substr(1, 6)}`)
        .set({ 'x-access-token': adminToken })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body.documents.count).to.be.greaterThan(0);
          expect(res.body.pagination.page_count).to.be.greaterThan(0);
          expect(res.body.pagination.Page).to.be.greaterThan(0);
          expect(res.body.pagination.page_size).to.greaterThan(0);
          expect(res.body.pagination.total_count).to.be.greaterThan(0);
          done();
        });
    });

    it('should return "enter search string" when search query is not supplied',
    (done) => {
      superRequest.get('/documents/search')
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.status).to.equal(400);
          expect(res.body.message).to.equal('Please enter a search query');
          done();
        });
    });

    it('should return error for negative limit', (done) => {
      superRequest.get(`/documents/search?query=
      ${publicD.content.substr(2, 6)}&limit=-2`)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.status).to.equal(400);
          expect(res.body.message).to
            .equal('Only positive number is allowed for limit value');
          done();
        });
    });

    it('should return error for negative offset', (done) => {
      superRequest.get(`/documents/search?query=
      ${publicD.content.substr(2, 6)}&limit=2&offset=-2`)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.status).to.equal(400);
          expect(res.body.message).to
            .equal('Only positive number is allowed for offset value');
          done();
        });
    });

    it('should return error when limit entered is string', (done) => {
      superRequest.get(`/documents/search?query=
      ${publicD.content.substr(2, 6)}&limit=aaa`)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.status).to.equal(400);
          expect(res.body.message).to
            .equal('Only positive number is allowed for limit value');
          done();
        });
    });

    it('should return documents in order of their respective published date',
    (done) => {
      superRequest.get(`/documents/search?query=
      ${publicD.content.substr(2, 6)}&publishedDate=DESC`)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          for (let i = 0; i < res.body.documents.rows.length - 1; i += 1) {
            const flag = compareDates(
              res.body.documents.rows[i].createdAt,
              res.body.documents.rows[1 + i].createdAt
            );
            expect(flag).to.equal(false);
          }
          done();
        });
    });

    it('should return documents in ascending order of published date',
    (done) => {
      superRequest.get(`/documents/search?query=
      ${publicD.content.substr(2, 6)}&publishedDate=ASC`)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          for (let i = 0; i < res.body.documents.rows.length - 1; i += 1) {
            const flag = compareDates(
              res.body.documents.rows[i].createdAt,
              res.body.documents.rows[1 + i].createdAt
            );
            expect(flag).to.equal(true);
          }
          done();
        });
    });
  });

  describe('Fetch all user\'s document', () => {
    it('should return all documents created by a particular user', (done) => {
      superRequest.get(`/users/${regularUser.id}/documents`)
        .set({ 'x-access-token': regularToken })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body.userDocuments.user.id).to.equal(regularUser.id);
          expect(res.body.userDocuments.documents.rows.length)
            .to.be.greaterThan(0);
          expect(res.body.userDocuments.documents.count).to.be.greaterThan(0);
          res.body.userDocuments.documents.rows.forEach((doc) => {
            expect(doc.access).to.be.oneOf(['public', 'role', 'private']);
          });
          done();
        });
    });

    it('should return all documents created by a particular user to admin user',
    (done) => {
      superRequest.get(`/users/${regularUser.id}/documents`)
        .set({ 'x-access-token': adminToken })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body.userDocuments.user.id).to.equal(regularUser.id);
          expect(res.body.userDocuments.documents.rows.length)
            .to.be.greaterThan(0);
          expect(res.body.userDocuments.documents.count).to.be.greaterThan(0);
          res.body.userDocuments.documents.rows.forEach((doc) => {
            expect(doc.access).to.be.oneOf(['public', 'role', 'private']);
          });
          done();
        });
    });

    it(`should return all public or role access level
    documents to a requester user`, (done) => {
      superRequest.get(`/users/${regularUser.id}/documents`)
        .set({ 'x-access-token': regularToken2 })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body.userDocuments.user.id).to.equal(regularUser.id);
          expect(res.body.userDocuments.documents.count).to.be.greaterThan(0);
          res.body.userDocuments.documents.rows.forEach((doc) => {
            expect(doc.access).to.be.oneOf(['role', 'public']);
          });
          done();
        });
    });

    it('should return no document found for invalid id', (done) => {
      superRequest.get('/users/0/documents')
        .set({ 'x-access-token': regularToken })
        .end((err, res) => {
          expect(res.status).to.equal(404);
          expect(res.body.message).to.equal('This user does not exist');
          done();
        });
    });
  });
});
